import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDistance, calculatePrice } from "@/lib/pricing";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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

    const body = await request.json();

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      destAddress,
      destLat,
      destLng,
      goodsType,
      goodsDescription,
      weight,
      length,
      width,
      height,
      quantity,
      isFragile,
      needsRefrigeration,
      driverId,
      vehicleId,
    } = body;

    // Validate required fields
    if (!pickupAddress || !pickupLat || !pickupLng || !destAddress || !destLat || !destLng || !goodsType || !weight) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate numeric fields
    const parsedLat = parseFloat(pickupLat);
    const parsedLng = parseFloat(pickupLng);
    const parsedDestLat = parseFloat(destLat);
    const parsedDestLng = parseFloat(destLng);
    const parsedWeight = parseFloat(weight);

    if (isNaN(parsedLat) || isNaN(parsedLng) || isNaN(parsedDestLat) || isNaN(parsedDestLng) || isNaN(parsedWeight)) {
      return NextResponse.json(
        { error: "Invalid coordinate or weight values" },
        { status: 400 }
      );
    }

    // Calculate distance
    const distance = calculateDistance(parsedLat, parsedLng, parsedDestLat, parsedDestLng);

    // Get or create passenger for the authenticated user
    let passenger = await prisma.passenger.findUnique({
      where: { userId: session.user.id },
    });
    if (!passenger) {
      passenger = await prisma.passenger.create({
        data: { userId: session.user.id },
      });
    }

    // Validate driver and vehicle if provided
    let vehicle = null;
    if (driverId && vehicleId) {
      const driver = await prisma.driver.findUnique({ where: { id: driverId } });
      vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

      if (!driver || !vehicle) {
        return NextResponse.json(
          { error: "Invalid driver or vehicle ID" },
          { status: 400 }
        );
      }
    }

    // Compute the price SERVER-SIDE from the active pricing rule for the
    // selected vehicle type. The client-supplied price is never trusted.
    let estimatedPrice: number | null = null;
    if (vehicle) {
      try {
        const pricing = await calculatePrice({
          distance,
          weight: parsedWeight,
          vehicleTypeId: vehicle.typeId,
          length: length ? parseFloat(length) : undefined,
          width: width ? parseFloat(width) : undefined,
          height: height ? parseFloat(height) : undefined,
          isFragile: isFragile || false,
          needsRefrigeration: needsRefrigeration || false,
        });
        estimatedPrice = pricing.total;
      } catch {
        return NextResponse.json(
          { error: "No active pricing rule found for the selected vehicle type" },
          { status: 400 }
        );
      }
    }

    // Create the transportation request
    const transportationRequest = await prisma.transportationRequest.create({
      data: {
        passengerId: passenger.id,
        pickupAddress,
        pickupLat: parsedLat,
        pickupLng: parsedLng,
        destAddress,
        destLat: parsedDestLat,
        destLng: parsedDestLng,
        goodsType,
        goodsDescription,
        weight: parsedWeight,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        quantity: quantity ? parseInt(quantity) : 1,
        isFragile: isFragile || false,
        needsRefrigeration: needsRefrigeration || false,
        distance,
        estimatedPrice,
        status: "pending",
      },
    });

    // Notify available drivers that a new request is available.
    const availableDrivers = await prisma.driver.findMany({
      where: { isAvailable: true, isApproved: true },
      select: { userId: true },
    });
    for (const driver of availableDrivers) {
      await prisma.notification.create({
        data: {
          userId: driver.userId,
          type: "new_request",
          title: "New Transportation Request",
          message: `A new request from ${pickupAddress} to ${destAddress} is available`,
          link: "/dashboard/available-requests",
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
    const where: any = {};

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // If user is a passenger, only show their requests
    if (session.user.role === "passenger") {
      const passenger = await prisma.passenger.findUnique({
        where: { userId: session.user.id },
      });
      if (passenger) {
        where.passengerId = passenger.id;
      }
    }

    // If user is a driver, show the open marketplace (pending unassigned
    // requests) plus requests already assigned to them via a trip.
    if (session.user.role === "driver") {
      const driver = await prisma.driver.findUnique({
        where: { userId: session.user.id },
      });
      if (driver) {
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
          where.OR = [where, { status: "pending" }, driverFilter].filter(Boolean);
        }
      }
    }

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

    // Drivers must NOT see the price before accepting a request. Null it out
    // so the amount is only revealed once the trip is completed.
    if (session.user.role === "driver") {
      for (const r of requests) {
        r.estimatedPrice = null;
      }
    }

    // Get total count for pagination
    const total = await prisma.transportationRequest.count({ where });

    return NextResponse.json({
      requests,
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