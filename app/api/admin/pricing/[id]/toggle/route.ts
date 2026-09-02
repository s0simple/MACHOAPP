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
    const { isActive } = await request.json();

    // Validate input
    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    // Check if pricing rule exists
    const rule = await prisma.pricingRule.findUnique({
      where: { id },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Pricing rule not found" },
        { status: 404 }
      );
    }

    const updatedRule = await prisma.pricingRule.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ 
      success: true, 
      rule: updatedRule 
    }, { status: 200 });
  } catch (error) {
    console.error("Toggle pricing rule error:", error);
    return NextResponse.json(
      { error: "Failed to update pricing rule" },
      { status: 500 }
    );
  }
}
