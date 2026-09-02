import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
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

    // Basic counts
    const totalDrivers = await prisma.driver.count();
    const approvedDrivers = await prisma.driver.count({
      where: { isApproved: true },
    });
    const totalPassengers = await prisma.passenger.count();
    const totalVehicles = await prisma.vehicle.count();
    const verifiedVehicles = await prisma.vehicle.count({
      where: { isVerified: true },
    });

    // Trip statistics
    const activeTrips = await prisma.trip.count({
      where: { status: { in: ["assigned", "in_transit"] } },
    });
    const completedTrips = await prisma.trip.count({
      where: { status: "completed" },
    });
    const cancelledTrips = await prisma.trip.count({
      where: { status: "cancelled" },
    });

    // Request statistics
    const pendingRequests = await prisma.transportationRequest.count({
      where: { status: "pending" },
    });
    const acceptedRequests = await prisma.transportationRequest.count({
      where: { status: "accepted" },
    });
    const completedRequests = await prisma.transportationRequest.count({
      where: { status: "completed" },
    });

    // Revenue statistics
    const revenueResult = await prisma.trip.aggregate({
      _sum: { 
        actualPrice: true,
        driverEarning: true,
      },
      where: { status: "completed" },
    });

    // Average trip price
    const avgTripPrice = await prisma.trip.aggregate({
      _avg: { actualPrice: true },
      where: { status: "completed" },
    });

    // Vehicle type distribution
    const vehicles = await prisma.vehicle.findMany({
      include: { vehicleType: { select: { name: true } } },
    });
    const typeMap = new Map<string, number>();
    vehicles.forEach((v) => {
      const name = v.vehicleType.name;
      typeMap.set(name, (typeMap.get(name) || 0) + 1);
    });
    const vehicleTypeDistribution = Array.from(typeMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // Request status distribution
    const requests = await prisma.transportationRequest.findMany({
      select: { status: true },
    });
    const statusMap = new Map<string, number>();
    requests.forEach((r) => {
      statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
    });
    const requestStatusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Driver availability
    const availableDrivers = await prisma.driver.count({
      where: { isAvailable: true, isApproved: true },
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTrips = await prisma.trip.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const recentRequests = await prisma.transportationRequest.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    return NextResponse.json({
      overview: {
        totalDrivers,
        approvedDrivers,
        totalPassengers,
        totalVehicles,
        verifiedVehicles,
        availableDrivers,
      },
      trips: {
        active: activeTrips,
        completed: completedTrips,
        cancelled: cancelledTrips,
        total: activeTrips + completedTrips + cancelledTrips,
        recent: recentTrips,
      },
      requests: {
        pending: pendingRequests,
        accepted: acceptedRequests,
        completed: completedRequests,
        total: pendingRequests + acceptedRequests + completedRequests,
        recent: recentRequests,
      },
      revenue: {
        total: revenueResult._sum.actualPrice || 0,
        driverEarnings: revenueResult._sum.driverEarning || 0,
        averageTripPrice: avgTripPrice._avg.actualPrice || 0,
      },
      distributions: {
        vehicleTypes: vehicleTypeDistribution,
        requestStatuses: requestStatusDistribution,
      },
    });
  } catch (error) {
    console.error("Fetch reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
