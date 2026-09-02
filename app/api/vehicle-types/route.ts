import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  try {
    // Any authenticated user may list vehicle types (drivers need them for
    // the add-vehicle form).
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let types = await prisma.vehicleType.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            vehicles: true,
            pricingRules: true,
          },
        },
      },
    });

    // Seed default vehicle types if the table is empty (first run).
    if (types.length === 0) {
      const defaults = [
        { name: "Mini Truck", description: "Small truck for light loads up to 2 tons" },
        { name: "Cargo Truck", description: "Medium truck for loads up to 5 tons" },
        { name: "Container Truck", description: "Large truck for heavy loads up to 20 tons" },
        { name: "Pickup Truck", description: "Pickup for small loads up to 1 ton" },
        { name: "Refrigerated Truck", description: "Cold-chain truck for perishable goods" },
      ];

      for (const dt of defaults) {
        const created = await prisma.vehicleType.create({
          data: { name: dt.name, description: dt.description },
        });
        types.push({ ...created, _count: { vehicles: 0, pricingRules: 0 } });
      }

      types.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json(types, { status: 200 });
  } catch (error) {
    console.error("Fetch vehicle types error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicle types" },
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

    // Verify admin access
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, icon } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existingType = await prisma.vehicleType.findUnique({
      where: { name },
    });

    if (existingType) {
      return NextResponse.json(
        { error: "Vehicle type with this name already exists" },
        { status: 409 }
      );
    }

    const vehicleType = await prisma.vehicleType.create({
      data: {
        name,
        description,
        icon,
      },
    });

    return NextResponse.json(vehicleType, { status: 201 });
  } catch (error) {
    console.error("Create vehicle type error:", error);
    return NextResponse.json(
      { error: "Failed to create vehicle type" },
      { status: 500 }
    );
  }
}
