import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// GET current availability status for the logged-in driver.
export async function GET() {
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

    const driver = await prisma.driver.findUnique({
      where: { userId: session.user.id },
      select: { isAvailable: true, isApproved: true },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { isAvailable: driver.isAvailable, isApproved: driver.isApproved },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

// PATCH toggles the driver's own availability. Drivers with an active trip
// (assigned or in_transit) cannot go available until the trip completes.
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
    const { isAvailable } = body;

    if (typeof isAvailable !== "boolean") {
      return NextResponse.json(
        { error: "Missing required field: isAvailable (boolean)" },
        { status: 400 }
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: session.user.id },
      include: {
        trips: {
          where: { status: { in: ["assigned", "in_transit"] } },
          select: { id: true },
        },
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver profile not found" },
        { status: 404 }
      );
    }

    if (!driver.isApproved) {
      return NextResponse.json(
        { error: "Your driver account is pending approval" },
        { status: 403 }
      );
    }

    // Going available while an active trip exists would break marketplace
    // matching logic — block it.
    if (isAvailable && driver.trips.length > 0) {
      return NextResponse.json(
        { error: "You have an active trip. Complete it before going available." },
        { status: 400 }
      );
    }

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable },
      select: { isAvailable: true },
    });

    return NextResponse.json(
      { isAvailable: updated.isAvailable },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update availability error:", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    );
  }
}