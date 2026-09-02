import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// PATCH /api/admin/vehicles/[id]/verify — admin toggles vehicle verification.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { isVerified } = await request.json();

    if (typeof isVerified !== "boolean") {
      return NextResponse.json(
        { error: "isVerified must be a boolean" },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { driver: { include: { user: true } } },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: { isVerified },
    });

    // Notify the driver about the verification decision.
    await prisma.notification.create({
      data: {
        userId: vehicle.driver.userId,
        type: "system",
        title: isVerified ? "Vehicle Verified" : "Vehicle Rejected",
        message: isVerified
          ? `Your vehicle (${vehicle.make} ${vehicle.model} - ${vehicle.registrationNumber}) has been verified.`
          : `Your vehicle (${vehicle.make} ${vehicle.model} - ${vehicle.registrationNumber}) was not verified. Please contact support.`,
        link: "/dashboard/vehicles",
      },
    });

    return NextResponse.json({ success: true, vehicle: updated }, { status: 200 });
  } catch (error) {
    console.error("Verify vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}