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
    const skip = (page - 1) * limit;

    const passengers = await prisma.passenger.findMany({
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
        _count: {
          select: {
            requests: true,
          },
        },
      },
    });

    const total = await prisma.passenger.count();

    return NextResponse.json({
      passengers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch passengers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch passengers" },
      { status: 500 }
    );
  }
}
