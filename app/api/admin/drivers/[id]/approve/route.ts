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

    // Verify admin access
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { isApproved } = await request.json();

    // Validate input
    if (typeof isApproved !== "boolean") {
      return NextResponse.json(
        { error: "isApproved must be a boolean" },
        { status: 400 }
      );
    }

    // Check if driver exists
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      );
    }

    // Update driver approval status
    const updatedDriver = await prisma.driver.update({
      where: { id },
      data: { isApproved },
    });

    // Create notification for driver
    await prisma.notification.create({
      data: {
        userId: driver.userId,
        type: "system",
        title: isApproved ? "Driver Approved" : "Driver Suspended",
        message: isApproved 
          ? "Your driver account has been approved. You can now start accepting trips."
          : "Your driver account has been suspended. Please contact support for more information.",
        link: "/dashboard",
      },
    });

    return NextResponse.json({ 
      success: true, 
      driver: updatedDriver 
    }, { status: 200 });
  } catch (error) {
    console.error("Approve driver error:", error);
    return NextResponse.json(
      { error: "Failed to update driver" },
      { status: 500 }
    );
  }
}
