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
    const isActive = searchParams.get("active");
    const vehicleTypeId = searchParams.get("vehicleTypeId");
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};
    
    if (isActive === "true") {
      where.isActive = true;
    } else if (isActive === "false") {
      where.isActive = false;
    }
    
    if (vehicleTypeId) {
      where.vehicleTypeId = vehicleTypeId;
    }

    const rules = await prisma.pricingRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        vehicleType: { select: { name: true, description: true } },
      },
    });

    const total = await prisma.pricingRule.count({ where });

    return NextResponse.json({
      rules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch pricing rules error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing rules" },
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
    const { 
      vehicleTypeId, 
      baseRate, 
      perKmRate, 
      perKgRate, 
      minPrice, 
      surgeMultiplier,
      effectiveFrom,
      effectiveTo 
    } = body;

    // Validate required fields
    if (!vehicleTypeId || !baseRate || !perKmRate || !perKgRate || !minPrice) {
      return NextResponse.json(
        { error: "Missing required fields: vehicleTypeId, baseRate, perKmRate, perKgRate, minPrice" },
        { status: 400 }
      );
    }

    // Validate numeric fields
    const parsedBaseRate = parseFloat(baseRate);
    const parsedPerKmRate = parseFloat(perKmRate);
    const parsedPerKgRate = parseFloat(perKgRate);
    const parsedMinPrice = parseFloat(minPrice);
    const parsedSurgeMultiplier = surgeMultiplier ? parseFloat(surgeMultiplier) : 1.0;

    if (isNaN(parsedBaseRate) || isNaN(parsedPerKmRate) || isNaN(parsedPerKgRate) || isNaN(parsedMinPrice)) {
      return NextResponse.json(
        { error: "Invalid numeric values" },
        { status: 400 }
      );
    }

    // Verify vehicle type exists
    const vehicleType = await prisma.vehicleType.findUnique({
      where: { id: vehicleTypeId },
    });

    if (!vehicleType) {
      return NextResponse.json(
        { error: "Invalid vehicle type" },
        { status: 400 }
      );
    }

    const rule = await prisma.pricingRule.create({
      data: {
        vehicleTypeId,
        baseRate: parsedBaseRate,
        perKmRate: parsedPerKmRate,
        perKgRate: parsedPerKgRate,
        minPrice: parsedMinPrice,
        surgeMultiplier: parsedSurgeMultiplier,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: true,
      },
      include: {
        vehicleType: { select: { name: true } },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Create pricing rule error:", error);
    return NextResponse.json(
      { error: "Failed to create pricing rule" },
      { status: 500 }
    );
  }
}
