import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get session for authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const transportationRequest = await prisma.transportationRequest.findUnique({
      where: { id },
      include: {
        passenger: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!transportationRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (transportationRequest.status !== "pending") {
      return NextResponse.json({ error: "Request is no longer available" }, { status: 400 });
    }

    // Get current user's driver profile
    const driver = await prisma.driver.findUnique({
      where: { userId: session.user.id },
      include: {
        vehicles: {
          where: { status: "available", isVerified: true },
        },
      },
    });

    if (!driver) {
      return NextResponse.json({ error: "Only drivers can accept requests" }, { status: 403 });
    }

    if (!driver.isApproved) {
      return NextResponse.json({ error: "Your driver account is not approved" }, { status: 403 });
    }

    if (!driver.isAvailable) {
      return NextResponse.json({ error: "You are not currently available" }, { status: 400 });
    }

    if (driver.vehicles.length === 0) {
      return NextResponse.json({ error: "No available vehicle found" }, { status: 400 });
    }

    // Find a vehicle that can handle the weight
    const vehicle = driver.vehicles.find(v => v.capacity >= transportationRequest.weight);
    
    if (!vehicle) {
      return NextResponse.json({ error: "No vehicle with sufficient capacity" }, { status: 400 });
    }

    // Update request status
    const updatedRequest = await prisma.transportationRequest.update({
      where: { id },
      data: { status: "accepted" },
    });

    // Create trip
    const trip = await prisma.trip.create({
      data: {
        requestId: id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: "assigned",
        actualPrice: transportationRequest.estimatedPrice,
        driverEarning: transportationRequest.estimatedPrice ? transportationRequest.estimatedPrice * 0.85 : null,
      },
    });

    // Update vehicle status
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: "in_transit" },
    });

    // Update driver availability
    await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: false },
    });

    // Create notification for driver
    await prisma.notification.create({
      data: {
        userId: driver.userId,
        type: "trip_update",
        title: "Trip Accepted",
        message: `You accepted a trip from ${transportationRequest.pickupAddress} to ${transportationRequest.destAddress}`,
        link: "/dashboard/my-trips",
      },
    });

    // Create notification for passenger
    await prisma.notification.create({
      data: {
        userId: transportationRequest.passenger.userId,
        type: "trip_update",
        title: "Driver Assigned",
        message: `A driver has been assigned to your trip from ${transportationRequest.pickupAddress} to ${transportationRequest.destAddress}`,
        link: "/dashboard/requests",
      },
    });

    return NextResponse.json({ 
      request: updatedRequest,
      trip 
    }, { status: 200 });
  } catch (error) {
    console.error("Accept request error:", error);
    return NextResponse.json(
      { error: "Failed to accept request" },
      { status: 500 }
    );
  }
}
