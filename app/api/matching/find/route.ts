import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { findMatchingTrucks } from "@/lib/matching";

/**
 * Find trucks matching a shipment. Used by the New Request flow's
 * "Choose a Truck" step. Requires an authenticated session; the caller may
 * pass optional goods dimensions so the matcher can exclude vehicles that
 * cannot fit the load.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();

    const num = (v: unknown) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const pickupLat = num(body.pickupLat);
    const pickupLng = num(body.pickupLng);
    const destLat = num(body.destLat);
    const destLng = num(body.destLng);
    const weight = num(body.weight);
    const length = num(body.length);
    const width = num(body.width);
    const height = num(body.height);

    if (
      pickupLat === undefined || pickupLng === undefined ||
      destLat === undefined || destLng === undefined ||
      weight === undefined || weight <= 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields: pickupLat, pickupLng, destLat, destLng, weight" },
        { status: 400 }
      );
    }

    const matches = await findMatchingTrucks({
      pickupLat,
      pickupLng,
      destLat,
      destLng,
      weight,
      preferredVehicleType: body.preferredVehicleType || undefined,
      isFragile: Boolean(body.isFragile),
      needsRefrigeration: Boolean(body.needsRefrigeration),
      length,
      width,
      height,
    });

    return NextResponse.json({ matches }, { status: 200 });
  } catch (error) {
    console.error("Matching error:", error);
    return NextResponse.json(
      { error: "Failed to find matching trucks" },
      { status: 500 }
    );
  }
}
