import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Driver earnings with server-side aggregation.
 *
 * GET /api/driver/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - `from`/`to` are optional; defaults cover the last 12 months.
 * - Totals are computed with Prisma `aggregate`, so they are correct no
 *   matter how many trips the driver has (the old client-side approach
 *   summed only the first page of /api/trips and drifted once a driver
 *   exceeded 20 completed trips).
 * - Also returns a fixed last-12-months breakdown for the monthly chart
 *   and the completed trips inside the requested range.
 */

const MONTHS_IN_BREAKDOWN = 12;
const TRIPS_LIST_MAX = 100;

interface MonthlyBucket {
  month: string; // "YYYY-MM"
  label: string; // "Sep 2026"
  total: number;
  trips: number;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[(m ?? 1) - 1]} ${y}`;
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (session.user.role !== "driver") {
      return NextResponse.json({ error: "Only drivers can view earnings" }, { status: 403 });
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ error: "Driver profile not found" }, { status: 400 });
    }

    // --- Range parsing ---------------------------------------------------
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = startOfMonth(
      new Date(now.getFullYear(), now.getMonth() - (MONTHS_IN_BREAKDOWN - 1), 1)
    );

    let from = defaultFrom;
    let to = now;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (fromParam) {
      const d = new Date(`${fromParam}T00:00:00`);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
      }
      from = d;
    }
    if (toParam) {
      const d = new Date(`${toParam}T23:59:59.999`);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });
      }
      to = d;
    }
    if (from > to) {
      return NextResponse.json({ error: "'from' must be before 'to'" }, { status: 400 });
    }

    // Completed trips are attributed by completion time.
    const rangeWhere = {
      driverId: driver.id,
      status: "completed",
      completedAt: { gte: from, lte: to },
    };

    // --- Accurate totals via aggregate (not limited by pagination) -------
    const agg = await prisma.trip.aggregate({
      where: rangeWhere,
      _sum: { driverEarning: true },
      _count: { id: true },
    });
    const totalEarnings = Number(agg._sum.driverEarning ?? 0);
    const completedTrips = agg._count.id ?? 0;

    // --- Monthly breakdown: fixed last-12-months window ------------------
    const monthlyFrom = startOfMonth(
      new Date(now.getFullYear(), now.getMonth() - (MONTHS_IN_BREAKDOWN - 1), 1)
    );
    const monthlyTrips = await prisma.trip.findMany({
      where: {
        driverId: driver.id,
        status: "completed",
        completedAt: { gte: monthlyFrom },
      },
      select: { driverEarning: true, completedAt: true },
    });

    const buckets = new Map<string, MonthlyBucket>();
    for (let i = 0; i < MONTHS_IN_BREAKDOWN; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { month: key, label: monthLabel(key), total: 0, trips: 0 });
    }
    for (const t of monthlyTrips) {
      if (!t.completedAt) continue;
      const d = t.completedAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.total += Number(t.driverEarning ?? 0);
        bucket.trips += 1;
      }
    }
    // Oldest → newest for chart-style display.
    const monthly = Array.from(buckets.values()).reverse();

    // --- Trips inside the selected range ---------------------------------
    const trips = await prisma.trip.findMany({
      where: rangeWhere,
      orderBy: { completedAt: "desc" },
      take: TRIPS_LIST_MAX,
      select: {
        id: true,
        driverEarning: true,
        actualPrice: true,
        completedAt: true,
        request: { select: { pickupAddress: true, destAddress: true } },
      },
    });

    return NextResponse.json(
      {
        range: { from: from.toISOString(), to: to.toISOString() },
        summary: {
          totalEarnings,
          completedTrips,
          averagePerTrip: completedTrips > 0 ? totalEarnings / completedTrips : 0,
        },
        monthly,
        trips,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Driver earnings error:", error);
    return NextResponse.json({ error: "Failed to load earnings" }, { status: 500 });
  }
}