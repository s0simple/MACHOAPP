import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    // Get session for authentication — trip listings are never public.
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
    
    if (status) {
      where.status = status;
    }

    // Filter based on user role
    if (session?.user) {
      if (session.user.role === "driver") {
        const driver = await prisma.driver.findUnique({
          where: { userId: session.user.id },
        });
        if (driver) {
          where.driverId = driver.id;
        }
      } else if (session.user.role === "passenger") {
        const passenger = await prisma.passenger.findUnique({
          where: { userId: session.user.id },
        });
        if (passenger) {
          where.request = { passengerId: passenger.id };
        }
      }
      // Admins can see all trips
    }

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        request: {
          include: {
            passenger: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
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
    });

    const total = await prisma.trip.count({ where });

    return NextResponse.json({
      trips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch trips error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
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
    const { tripId, status } = body;

    if (!tripId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: tripId, status" },
        { status: 400 }
      );
    }

    // Valid status transitions
    const validStatuses = ["assigned", "in_transit", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { request: true, driver: true, vehicle: true },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    // Verify user has permission to update this trip
    if (session.user.role === "driver") {
      const driver = await prisma.driver.findUnique({
        where: { userId: session.user.id },
      });
      if (!driver || trip.driverId !== driver.id) {
        return NextResponse.json(
          { error: "Unauthorized to update this trip" },
          { status: 403 }
        );
      }
    }

    // Update trip
    const updateData: any = { status };

    if (status === "in_transit" && !trip.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === "completed") {
      updateData.completedAt = new Date();
      // Finalize earnings from the server-side price on the linked request.
      // Client-supplied prices are never trusted.
      const finalPrice = trip.request.estimatedPrice ?? trip.actualPrice;
      if (finalPrice !== null) {
        updateData.actualPrice = finalPrice;
        updateData.driverEarning = finalPrice * 0.85;
      }
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
    });

    // Update request status if trip is completed or cancelled
    if (status === "completed" || status === "cancelled") {
      await prisma.transportationRequest.update({
        where: { id: trip.requestId },
        data: { status: status === "completed" ? "completed" : "cancelled" },
      });

      // Update vehicle status back to available
      await prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { status: "available" },
      });
    }

    // Create notification for passenger
    const statusMessages: Record<string, string> = {
      in_transit: "Your trip has started",
      completed: "Your trip has been completed",
      cancelled: "Your trip has been cancelled",
    };

    if (statusMessages[status]) {
      // Notify the passenger's USER account (passengerId is not a userId).
      const requestWithPassenger = await prisma.transportationRequest.findUnique({
        where: { id: trip.requestId },
        include: { passenger: { select: { userId: true } } },
      });
      if (requestWithPassenger) {
        await prisma.notification.create({
          data: {
            userId: requestWithPassenger.passenger.userId,
            type: "trip_update",
            title: "Trip Update",
            message: statusMessages[status],
            link: "/dashboard/requests",
          },
        });
      }
    }

    // On completion, reveal the price to BOTH parties via notification.
    if (status === "completed") {
      const finalPrice = updatedTrip.actualPrice ?? trip.request.estimatedPrice;
      if (finalPrice !== null) {
        const priceMsg = `Trip ended. Customer will pay GHS ${Number(finalPrice).toFixed(2)}.`;
        // Notify the passenger
        const requestWithPassenger = await prisma.transportationRequest.findUnique({
          where: { id: trip.requestId },
          include: { passenger: { select: { userId: true } } },
        });
        if (requestWithPassenger) {
          await prisma.notification.create({
            data: {
              userId: requestWithPassenger.passenger.userId,
              type: "trip_completed",
              title: "Trip Completed",
              message: priceMsg,
              link: "/dashboard/requests",
            },
          });
        }
        // Notify the driver
        await prisma.notification.create({
          data: {
            userId: trip.driver.userId,
            type: "trip_completed",
            title: "Trip Completed",
            message: priceMsg,
            link: "/dashboard/my-trips",
          },
        });
      }
    }

    return NextResponse.json(updatedTrip, { status: 200 });
  } catch (error) {
    console.error("Update trip error:", error);
    return NextResponse.json(
      { error: "Failed to update trip" },
      { status: 500 }
    );
  }
}
