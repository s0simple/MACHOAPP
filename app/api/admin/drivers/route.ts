import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    // Get session for authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Verify admin access
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status"); // approved, pending, all
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};
    
    if (status === "approved") {
      where.isApproved = true;
    } else if (status === "pending") {
      where.isApproved = false;
    }

    const drivers = await prisma.driver.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { 
          select: { 
            id: true,
            name: true, 
            email: true,
            createdAt: true,
          } 
        },
        vehicles: {
          select: { 
            id: true, 
            make: true, 
            model: true, 
            registrationNumber: true,
            status: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            trips: true,
          },
        },
      },
    });

    const total = await prisma.driver.count({ where });

    return NextResponse.json({
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch drivers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drivers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, phone, licenseNumber } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if driver already exists
    const existingDriver = await prisma.driver.findUnique({
      where: { userId },
    });

    if (existingDriver) {
      return NextResponse.json(
        { error: "Driver profile already exists for this user" },
        { status: 409 }
      );
    }

    const driver = await prisma.driver.create({
      data: {
        userId,
        phone,
        licenseNumber,
        isApproved: false,
        isAvailable: true,
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    // Create notification for the new driver
    await prisma.notification.create({
      data: {
        userId,
        type: "system",
        title: "Driver Registration",
        message: "Your driver registration is pending approval",
        link: "/dashboard",
      },
    });

    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    console.error("Create driver error:", error);
    return NextResponse.json(
      { error: "Failed to create driver" },
      { status: 500 }
    );
  }
}
