import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { calculateRouteDistance } from "@/lib/geo";
import { calculatePrice, resolvePricingRuleForWeight } from "@/lib/pricing";
import { GOODS_TYPES, LIMITS, SERVICE_TYPE_VALUES } from "@/lib/constants";
import type { Prisma } from "@/lib/generated/prisma/client";

// Empty paginated result, used when a role-scoped user owns no requests.
// Fail-closed: a missing role profile must never fall through to an
// unfiltered query that would expose everyone's requests.
function emptyRequestList(page: number, limit: number) {
  return NextResponse.json(
    { requests: [], pagination: { page, limit, total: 0, totalPages: 0 } },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  try {
    // Get session for authentication — creating requests requires an account.
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Only passengers may create passenger transportation requests. Drivers
    // and admins manage requests through their own flows.
    if (session.user.role !== "passenger") {
      return NextResponse.json(
        { error: "Only passengers can create transportation requests" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // The passenger is ALWAYS derived from the authenticated session. Never
    // accept passengerId/driverId/vehicleId/estimatedPrice from the client.
    const passenger = await prisma.passenger.findUnique({
      where: { userId: session.user.id },
    });
    if (!passenger) {
      return NextResponse.json(
        {
          error:
            "Your passenger profile could not be found. Please contact support.",
        },
        { status: 400 }
      );
    }

    // --- Field extraction + validation --------------------------------
    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const num = (v: unknown): number | undefined => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const pickupAddress = str(body.pickupAddress);
    const destAddress = str(body.destAddress);
    const goodsType = str(body.goodsType);
    const goodsDescription = str(body.goodsDescription);
    const specialInstructions = str(body.specialInstructions);
    const serviceType = str(body.serviceType) || "transport_only";

    const pickupLat = num(body.pickupLat);
    const pickupLng = num(body.pickupLng);
    const destLat = num(body.destLat);
    const destLng = num(body.destLng);
    const weight = num(body.weight);
    const quantity = Math.floor(num(body.quantity) ?? 1);
    const length = num(body.length);
    const width = num(body.width);
    const height = num(body.height);
    const isFragile = Boolean(body.isFragile);
    const needsRefrigeration = Boolean(body.needsRefrigeration);

    const pickupAtVal = body.pickupAt;
    const deliveryDeadlineVal = body.deliveryDeadline;

    // Optional preferred truck (from the "Choose a Truck" step). The client
    // may suggest a vehicle; the server verifies it is actually suitable
    // before storing it. driverId is only used for the targeted notification.
    const requestedVehicleId = typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
    const requestedDriverId = typeof body.driverId === "string" ? body.driverId.trim() : "";

    // Required strings
    if (!pickupAddress || pickupAddress.length > LIMITS.maxAddressLength) {
      return NextResponse.json(
        { error: `Pickup address is required and must be under ${LIMITS.maxAddressLength} characters` },
        { status: 400 }
      );
    }
    if (!destAddress || destAddress.length > LIMITS.maxAddressLength) {
      return NextResponse.json(
        { error: `Destination address is required and must be under ${LIMITS.maxAddressLength} characters` },
        { status: 400 }
      );
    }
    if (!goodsType || !GOODS_TYPES.includes(goodsType as (typeof GOODS_TYPES)[number])) {
      return NextResponse.json(
        { error: "Please select a valid goods type" },
        { status: 400 }
      );
    }
    if (goodsDescription.length > LIMITS.maxDescriptionLength) {
      return NextResponse.json(
        { error: `Description must be under ${LIMITS.maxDescriptionLength} characters` },
        { status: 400 }
      );
    }
    if (specialInstructions.length > LIMITS.maxInstructionsLength) {
      return NextResponse.json(
        { error: `Special instructions must be under ${LIMITS.maxInstructionsLength} characters` },
        { status: 400 }
      );
    }
    if (!SERVICE_TYPE_VALUES.includes(serviceType as (typeof SERVICE_TYPE_VALUES)[number])) {
      return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
    }

    // Coordinates
    if (
      pickupLat === undefined || pickupLng === undefined ||
      destLat === undefined || destLng === undefined ||
      Math.abs(pickupLat) > 90 || Math.abs(pickupLng) > 180 ||
      Math.abs(destLat) > 90 || Math.abs(destLng) > 180
    ) {
      return NextResponse.json(
        { error: "Valid pickup and destination coordinates are required" },
        { status: 400 }
      );
    }

    // Weight
    if (weight === undefined || weight <= 0 || weight > LIMITS.maxWeightKg) {
      return NextResponse.json(
        { error: `Weight must be greater than 0 and at most ${LIMITS.maxWeightKg} kg` },
        { status: 400 }
      );
    }

    // Quantity
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > LIMITS.maxQuantity) {
      return NextResponse.json(
        { error: `Quantity must be between 1 and ${LIMITS.maxQuantity}` },
        { status: 400 }
      );
    }

    // Dimensions (optional, but must be positive when supplied)
    for (const [name, v] of [
      ["length", length],
      ["width", width],
      ["height", height],
    ] as const) {
      if (v !== undefined && (v <= 0 || v > LIMITS.maxDimensionM)) {
        return NextResponse.json(
          { error: `${name} must be a positive number up to ${LIMITS.maxDimensionM} m` },
          { status: 400 }
        );
      }
    }

    // Dates. Ghana is UTC+0 year-round, so the wall clock == UTC and we can
    // validate "future" without timezone math.
    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + LIMITS.minLeadTimeHours * 60 * 60 * 1000);
    const latestAllowed = new Date(now.getTime() + LIMITS.maxAdvanceDays * 24 * 60 * 60 * 1000);

    let pickupAt: Date | null | undefined;
    if (pickupAtVal === null || pickupAtVal === undefined || pickupAtVal === "") {
      pickupAt = null;
    } else {
      const d = new Date(pickupAtVal as string);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid pickup date/time" }, { status: 400 });
      }
      if (d < earliestAllowed) {
        return NextResponse.json(
          { error: "Pickup must be at least 1 hour from now" },
          { status: 400 }
        );
      }
      if (d > latestAllowed) {
        return NextResponse.json(
          { error: `Pickup cannot be more than ${LIMITS.maxAdvanceDays} days ahead` },
          { status: 400 }
        );
      }
      pickupAt = d;
    }

    let deliveryDeadline: Date | null | undefined;
    if (deliveryDeadlineVal === null || deliveryDeadlineVal === undefined || deliveryDeadlineVal === "") {
      deliveryDeadline = null;
    } else {
      const d = new Date(deliveryDeadlineVal as string);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid delivery deadline" }, { status: 400 });
      }
      if (pickupAt && d <= pickupAt) {
        return NextResponse.json(
          { error: "Delivery deadline must be after the pickup time" },
          { status: 400 }
        );
      }
      if (d < earliestAllowed) {
        return NextResponse.json(
          { error: "Delivery deadline must be at least 1 hour from now" },
          { status: 400 }
        );
      }
      deliveryDeadline = d;
    }

    // --- Preferred vehicle validation (optional) --------------------------
    let preferredVehicleId: string | null = null;
    let preferredDriverUserId: string | null = null;
    let preferredVehicleTypeId: string | null = null;
    let preferredVehicleLabel = "";
    if (requestedVehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: requestedVehicleId },
        include: { driver: { select: { id: true, userId: true, isAvailable: true, isApproved: true } } },
      });
      if (
        !vehicle ||
        vehicle.status !== "available" ||
        !vehicle.isVerified ||
        !vehicle.driver.isAvailable ||
        !vehicle.driver.isApproved
      ) {
        return NextResponse.json(
          { error: "The selected truck is no longer available. Please choose another one." },
          { status: 400 }
        );
      }
      if (vehicle.capacity < (weight ?? 0)) {
        return NextResponse.json(
          { error: "The selected truck cannot carry this load. Please choose a bigger one." },
          { status: 400 }
        );
      }
      if (needsRefrigeration && !vehicle.hasRefrigeration) {
        return NextResponse.json(
          { error: "This shipment needs refrigeration and the selected truck does not support it." },
          { status: 400 }
        );
      }
      if (length && vehicle.length && vehicle.length < length) {
        return NextResponse.json({ error: "The selected truck is too short for these goods." }, { status: 400 });
      }
      if (width && vehicle.width && vehicle.width < width) {
        return NextResponse.json({ error: "The selected truck is too narrow for these goods." }, { status: 400 });
      }
      if (height && vehicle.height && vehicle.height < height) {
        return NextResponse.json({ error: "The selected truck is too low for these goods." }, { status: 400 });
      }
      if (requestedDriverId && vehicle.driver.id !== requestedDriverId) {
        return NextResponse.json({ error: "Invalid driver for the selected truck." }, { status: 400 });
      }
      preferredVehicleId = vehicle.id;
      preferredDriverUserId = vehicle.driver.userId;
      preferredVehicleTypeId = vehicle.typeId;
      preferredVehicleLabel = `${vehicle.make} ${vehicle.model}`.trim();
    }

    // --- Distance: road route via OSRM, Haversine fallback --------------
    const { route } = await calculateRouteDistance(
      { lat: pickupLat, lng: pickupLng },
      { lat: destLat, lng: destLng }
    );
    const distance = route.distanceKm;

    // --- Price: server-side only. With a chosen truck, price with THAT
    // truck's vehicle type; otherwise derive the type from the weight. -----
    const rule = preferredVehicleTypeId
      ? await prisma.pricingRule.findFirst({
          where: { vehicleTypeId: preferredVehicleTypeId, isActive: true },
        })
      : await resolvePricingRuleForWeight(weight);
    if (!rule) {
      return NextResponse.json(
        { error: "Pricing is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    const pricing = await calculatePrice({
      distance,
      weight,
      vehicleTypeId: rule.vehicleTypeId,
      length,
      width,
      height,
      isFragile,
      needsRefrigeration,
    });
    // Never trust a client-supplied price.
    const estimatedPrice = Number(pricing.total ?? 0);

    // --- Create the request ----------------------------------------------
    const transportationRequest = await prisma.transportationRequest.create({
      data: {
        passengerId: passenger.id,
        pickupAddress,
        pickupLat,
        pickupLng,
        destAddress,
        destLat,
        destLng,
        goodsType,
        goodsDescription: goodsDescription || null,
        weight,
        length: length ?? null,
        width: width ?? null,
        height: height ?? null,
        quantity,
        isFragile,
        needsRefrigeration,
        pickupAt: pickupAt ?? null,
        deliveryDeadline: deliveryDeadline ?? null,
        serviceType,
        specialInstructions: specialInstructions || null,
        preferredVehicleId,
        distance,
        estimatedPrice,
        status: "pending",
      },
    });

    // Notify drivers. When the passenger chose a specific truck, only that
    // driver is notified; otherwise the request is broadcast to all
    // available, approved drivers.
    const notifyUserIds = preferredDriverUserId
      ? [preferredDriverUserId]
      : (
          await prisma.driver.findMany({
            where: { isAvailable: true, isApproved: true },
            select: { userId: true },
          })
        ).map((d) => d.userId);
    const notifyTitle = preferredDriverUserId
      ? "A Passenger Chose Your Truck"
      : "New Transportation Request";
    const notifyMessage = preferredDriverUserId
      ? `A passenger requested your ${preferredVehicleLabel} for a trip from ${pickupAddress} to ${destAddress}`
      : `A new request from ${pickupAddress} to ${destAddress} is available`;
    for (const userId of notifyUserIds) {
      await prisma.notification.create({
        data: {
          userId,
          type: "new_request",
          title: notifyTitle,
          message: notifyMessage,
          link: preferredDriverUserId ? "/dashboard/requests" : "/dashboard/available-requests",
        },
      });
    }

    return NextResponse.json(
      { request: transportationRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create request error:", error);
    return NextResponse.json(
      { error: "Failed to create transportation request" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Get session for authentication — request listings are never public.
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: Prisma.TransportationRequestWhereInput = {};

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Role scoping. Fail-closed: if the user's role profile (Passenger/Driver
    // row) does not exist, they own no requests, so return an empty list
    // instead of skipping the filter and exposing every request.
    if (session.user.role === "passenger") {
      const passenger = await prisma.passenger.findUnique({
        where: { userId: session.user.id },
      });
      if (!passenger) {
        return emptyRequestList(page, limit);
      }
      where.passengerId = passenger.id;
    } else if (session.user.role === "driver") {
      const driver = await prisma.driver.findUnique({
        where: { userId: session.user.id },
      });
      if (!driver) {
        return emptyRequestList(page, limit);
      }
      // Drivers see the open marketplace (pending, unassigned requests) plus
      // requests already assigned to them via a trip. NOTE: never embed the
      // bare `where` object inside OR — `OR: [{}]` matches every record.
      const driverFilter = { trip: { driverId: driver.id } };
      if (where.status) {
        // Specific status requested: pending = open marketplace, anything
        // else = only requests assigned to this driver via a trip.
        if (where.status === "pending") {
          where.trip = null;
        } else {
          Object.assign(where, driverFilter);
        }
      } else {
        where.OR = [{ status: "pending", trip: null }, driverFilter];
      }
    } else if (session.user.role !== "admin") {
      // Unknown/unsupported role: fail closed with an empty list.
      return emptyRequestList(page, limit);
    }
    // Admins can see all requests

    const requests = await prisma.transportationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        passenger: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        trip: {
          include: {
            driver: {
              include: {
                user: { select: { name: true } },
              },
            },
            vehicle: {
              include: {
                vehicleType: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const total = await prisma.transportationRequest.count({ where });
    const requestsData =
      session.user.role === "driver"
        ? requests.map((r) => ({ ...r, estimatedPrice: null }))
        : requests;

    return NextResponse.json({
      requests: requestsData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}