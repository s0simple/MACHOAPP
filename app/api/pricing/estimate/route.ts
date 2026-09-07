import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { calculateRouteDistance, type GeoPoint } from "@/lib/geo";
import { calculatePrice, resolvePricingRuleForWeight } from "@/lib/pricing";
import { LIMITS } from "@/lib/constants";

/**
 * Server-side price estimation for the New Request flow.
 *
 * The client sends coordinates + goods info; the server:
 *   1. Validates everything (never trusts the client).
 *   2. Computes road distance via OSRM (Haversine fallback).
 *   3. Derives the smallest suitable vehicle type from the weight.
 *   4. Runs the existing DB-driven pricing engine.
 *
 * Returns the estimate plus the derived vehicle requirements so the UI can
 * show "Required capacity: at least X kg" etc.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const pickup = body.pickup as GeoPoint | undefined;
    const dest = body.dest as GeoPoint | undefined;
    const weight = Number(body.weight);
    const length = body.length === undefined || body.length === null || body.length === "" ? undefined : Number(body.length);
    const width = body.width === undefined || body.width === null || body.width === "" ? undefined : Number(body.width);
    const height = body.height === undefined || body.height === null || body.height === "" ? undefined : Number(body.height);
    const isFragile = Boolean(body.isFragile);
    const needsRefrigeration = Boolean(body.needsRefrigeration);
    // When the passenger picked a specific truck, price with THAT truck's
    // vehicle type instead of the weight-derived type.
    const requestedVehicleTypeId =
      typeof body.vehicleTypeId === "string" && body.vehicleTypeId.trim() !== ""
        ? body.vehicleTypeId.trim()
        : null;

    // --- Validation -------------------------------------------------------
    if (
      !pickup || !dest ||
      !Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng) ||
      !Number.isFinite(dest.lat) || !Number.isFinite(dest.lng) ||
      Math.abs(pickup.lat) > 90 || Math.abs(pickup.lng) > 180 ||
      Math.abs(dest.lat) > 90 || Math.abs(dest.lng) > 180
    ) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    if (!Number.isFinite(weight) || weight <= 0 || weight > LIMITS.maxWeightKg) {
      return NextResponse.json(
        { error: `Weight must be greater than 0 and at most ${LIMITS.maxWeightKg} kg` },
        { status: 400 }
      );
    }

    for (const [name, value] of [["length", length], ["width", width], ["height", height]] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0 || value > LIMITS.maxDimensionM)) {
        return NextResponse.json(
          { error: `${name} must be a positive number up to ${LIMITS.maxDimensionM} m` },
          { status: 400 }
        );
      }
    }

    // --- Distance (road routing with graceful fallback) -------------------
    const { route, fallback } = await calculateRouteDistance(pickup, dest);

    // --- Pricing ----------------------------------------------------------
    const rule = requestedVehicleTypeId
      ? await prisma.pricingRule.findFirst({
          where: { vehicleTypeId: requestedVehicleTypeId, isActive: true },
          include: { vehicleType: { select: { name: true } } },
        })
      : await resolvePricingRuleForWeight(weight);
    if (!rule) {
      return NextResponse.json(
        { error: "Pricing is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const breakdown = await calculatePrice({
      distance: route.distanceKm,
      weight,
      vehicleTypeId: rule.vehicleTypeId,
      length,
      width,
      height,
      isFragile,
      needsRefrigeration,
    });

    return NextResponse.json({
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      distanceFallback: fallback,
      vehicleTypeName: rule.vehicleType.name,
      requirements: {
        minCapacityKg: weight,
        needsRefrigeration,
        isFragile,
        dimensions: length && width && height ? { length, width, height } : null,
      },
      price: {
        ...breakdown,
        // Ensure the frontend always receives plain numbers.
        total: Number(breakdown.total ?? 0),
        baseRate: Number(breakdown.baseRate ?? 0),
        distanceCharge: Number(breakdown.distanceCharge ?? 0),
        weightCharge: Number(breakdown.weightCharge ?? 0),
        volumeCharge: Number(breakdown.volumeCharge ?? 0),
        fragileSurcharge: Number(breakdown.fragileSurcharge ?? 0),
        refrigerationSurcharge: Number(breakdown.refrigerationSurcharge ?? 0),
        subtotal: Number(breakdown.subtotal ?? 0),
      },
    });
  } catch (error) {
    console.error("Price estimate error:", error);
    return NextResponse.json(
      { error: "We couldn't calculate the price right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}