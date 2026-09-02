import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  AdminStats,
  DashboardData,
  DriverStats,
  PassengerStats,
  RecentRequestItem,
  RecentTripItem,
  UserRole,
} from "@/lib/dashboard-types";

// Normalize potentially-null / non-number monetary values (e.g. Prisma
// Decimal/Float aggregates) into plain JavaScript numbers before they reach
// the client. This prevents `undefined.toFixed` / Decimal serialization bugs.
function toMoney(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Convert a nullable price field into `number | null`.
function toNullableMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
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

    const userId = session.user.id;
    const userRole: UserRole =
      session.user.role === "driver" || session.user.role === "admin"
        ? session.user.role
        : "passenger";

    let data: DashboardData;

    if (userRole === "passenger") {
      // Passenger-specific stats. The profile is created lazily elsewhere
      // (e.g. on the user's first request), so a missing profile simply gets
      // zeroed stats — same behavior as before this refactor.
      const passenger = await prisma.passenger.findUnique({
        where: { userId },
      });

      if (passenger) {
        const [totalRequests, activeTrips, completedTrips, totalSpentResult, recentRequests] =
          await Promise.all([
            prisma.transportationRequest.count({
              where: { passengerId: passenger.id },
            }),
            prisma.trip.count({
              where: {
                request: { passengerId: passenger.id },
                status: { in: ["assigned", "in_transit"] },
              },
            }),
            prisma.trip.count({
              where: {
                request: { passengerId: passenger.id },
                status: "completed",
              },
            }),
            prisma.trip.aggregate({
              _sum: { actualPrice: true },
              where: {
                request: { passengerId: passenger.id },
                status: "completed",
              },
            }),
            prisma.transportationRequest.findMany({
              where: { passengerId: passenger.id },
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                pickupAddress: true,
                destAddress: true,
                status: true,
                createdAt: true,
                estimatedPrice: true,
              },
            }),
          ]);

        const stats: PassengerStats = {
          totalRequests,
          activeTrips,
          completedTrips,
          // Convert Prisma aggregate result (Decimal/Float | null) to a number.
          totalSpent: toMoney(totalSpentResult._sum.actualPrice),
        };

        data = {
          role: "passenger",
          stats,
          recentRequests: recentRequests.map((request) => ({
            id: request.id,
            pickupAddress: request.pickupAddress,
            destAddress: request.destAddress,
            status: request.status,
            createdAt: request.createdAt.toISOString(),
            estimatedPrice: toNullableMoney(request.estimatedPrice),
          })),
          unreadNotifications: 0,
        };
      } else {
        data = {
          role: "passenger",
          stats: { totalRequests: 0, activeTrips: 0, completedTrips: 0, totalSpent: 0 },
          recentRequests: [],
          unreadNotifications: 0,
        };
      }
    } else if (userRole === "driver") {
      // Driver-specific stats. Same lazy-profile behavior as passengers:
      // a missing Driver row yields zeroed stats rather than an error.
      const driver = await prisma.driver.findUnique({
        where: { userId },
      });

      if (driver) {
        const [totalTrips, activeTrips, completedTrips, totalEarningsResult, recentTrips] =
          await Promise.all([
            prisma.trip.count({
              where: { driverId: driver.id },
            }),
            prisma.trip.count({
              where: {
                driverId: driver.id,
                status: { in: ["assigned", "in_transit"] },
              },
            }),
            prisma.trip.count({
              where: {
                driverId: driver.id,
                status: "completed",
              },
            }),
            prisma.trip.aggregate({
              _sum: { driverEarning: true },
              where: {
                driverId: driver.id,
                status: "completed",
              },
            }),
            prisma.trip.findMany({
              where: { driverId: driver.id },
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                createdAt: true,
                actualPrice: true,
                driverEarning: true,
                request: {
                  select: {
                    pickupAddress: true,
                    destAddress: true,
                  },
                },
              },
            }),
          ]);

        const stats: DriverStats = {
          totalTrips,
          activeTrips,
          completedTrips,
          // Convert Prisma aggregate result (Decimal/Float | null) to a number.
          totalEarnings: toMoney(totalEarningsResult._sum.driverEarning),
          rating: Number(driver.rating ?? 0),
          isAvailable: driver.isAvailable,
        };

        const recentRequests: RecentTripItem[] = recentTrips.map((trip) => ({
          id: trip.id,
          pickupAddress: trip.request.pickupAddress,
          destAddress: trip.request.destAddress,
          status: trip.status,
          createdAt: trip.createdAt.toISOString(),
          // Prefer the driver's earning; fall back to the trip's actual price.
          driverEarning: toNullableMoney(trip.driverEarning ?? trip.actualPrice),
        }));

        data = {
          role: "driver",
          stats,
          recentRequests,
          unreadNotifications: 0,
        };
      } else {
        data = {
          role: "driver",
          stats: {
            totalTrips: 0,
            activeTrips: 0,
            completedTrips: 0,
            totalEarnings: 0,
            rating: 0,
            isAvailable: false,
          },
          recentRequests: [],
          unreadNotifications: 0,
        };
      }
    } else {
      // Admin gets platform-wide overview stats
      const [
        totalDrivers,
        totalPassengers,
        totalVehicles,
        activeTrips,
        completedTrips,
        totalRevenueResult,
        recentRequestsRaw,
      ] = await Promise.all([
        prisma.driver.count(),
        prisma.passenger.count(),
        prisma.vehicle.count(),
        prisma.trip.count({
          where: { status: { in: ["assigned", "in_transit"] } },
        }),
        prisma.trip.count({
          where: { status: "completed" },
        }),
        prisma.trip.aggregate({
          _sum: { actualPrice: true },
          where: { status: "completed" },
        }),
        prisma.transportationRequest.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            pickupAddress: true,
            destAddress: true,
            status: true,
            createdAt: true,
            estimatedPrice: true,
            passenger: {
              select: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        }),
      ]);

      const stats: AdminStats = {
        totalDrivers,
        totalPassengers,
        totalVehicles,
        activeTrips,
        completedTrips,
        // Convert Prisma aggregate result (Decimal/Float | null) to a number.
        totalRevenue: toMoney(totalRevenueResult._sum.actualPrice),
      };

      const recentRequests: RecentRequestItem[] = recentRequestsRaw.map(
        (request) => ({
          id: request.id,
          pickupAddress: request.pickupAddress,
          destAddress: request.destAddress,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
          estimatedPrice: toNullableMoney(request.estimatedPrice),
          passengerName: request.passenger?.user?.name ?? null,
        })
      );

      data = {
        role: "admin",
        stats,
        recentRequests,
        unreadNotifications: 0,
      };
    }

    // Get unread notification count
    const unreadNotifications = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    data.unreadNotifications = unreadNotifications;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}