import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    // Vehicle listings require authentication. Drivers see their own
    // vehicles; admins see all.
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
    const typeId = searchParams.get("typeId");
    const available = searchParams.get("available");
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (typeId) {
      where.typeId = typeId;
    }
    
    if (available === "true") {
      where.status = "available";
      where.isVerified = true;
    }

    // Drivers are scoped to their own fleet; admins can see everything.
    if (session.user.role !== "admin") {
      const driver = await prisma.driver.findUnique({
        where: { userId: session.user.id },
      });
      if (driver) {
        where.driverId = driver.id;
      } else {
        return NextResponse.json(
          { vehicles: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          { status: 200 }
        );
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        vehicleType: { select: { name: true, description: true } },
        driver: {
          include: {
            user: { select: { name: true } },
          },
        },
        images: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.vehicle.count({ where });

    return NextResponse.json({
      vehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch vehicles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { make, model, year, registrationNumber, typeId, capacity, color, length, width, height } = body;

    // Validate required fields
    if (!make || !model || !registrationNumber || !typeId || !capacity) {
      return NextResponse.json(
        { error: "Missing required fields: make, model, registrationNumber, typeId, capacity" },
        { status: 400 }
      );
    }

    // Validate capacity is a positive number
    const parsedCapacity = parseFloat(capacity);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      return NextResponse.json(
        { error: "Capacity must be a positive number" },
        { status: 400 }
      );
    }

    // Check if registration number already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registrationNumber },
    });
    if (existingVehicle) {
      return NextResponse.json(
        { error: "Vehicle with this registration number already exists" },
        { status: 409 }
      );
    }

    // Verify vehicle type exists
    const vehicleType = await prisma.vehicleType.findUnique({
      where: { id: typeId },
    });
    if (!vehicleType) {
      return NextResponse.json(
        { error: "Invalid vehicle type" },
        { status: 400 }
      );
    }

    // Get or create driver for current user
    let driver = await prisma.driver.findUnique({
      where: { userId: session.user.id },
    });
    
    if (!driver) {
      // Create driver profile if user is a driver
      if (session.user.role === "driver") {
        driver = await prisma.driver.create({
          data: { userId: session.user.id },
        });
      } else {
        return NextResponse.json(
          { error: "Only drivers can add vehicles" },
          { status: 403 }
        );
      }
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        driverId: driver.id,
        make,
        model,
        year: year ? parseInt(year) : null,
        registrationNumber: registrationNumber.toUpperCase(),
        typeId,
        capacity: parsedCapacity,
        color: color || null,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        status: "available",
        isVerified: false, // Requires admin verification
      },
    });

    // Create notification for admin about new vehicle
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
    });
    
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "system",
          title: "New Vehicle Registration",
          message: `A new vehicle (${make} ${model} - ${registrationNumber}) requires verification`,
          link: "/dashboard/vehicles",
        },
      });
    }

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    console.error("Create vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 }
    );
  }
}
