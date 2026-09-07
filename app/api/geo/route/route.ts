import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { calculateRouteDistance, type GeoPoint } from "@/lib/geo";

/**
 * Authenticated proxy for OSRM road routing. Returns the estimated road
 * distance/duration between two coordinates, with a graceful Haversine
 * fallback when the routing service is unavailable.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const pickup = body?.pickup as GeoPoint | undefined;
    const dest = body?.dest as GeoPoint | undefined;

    if (
      !pickup || !dest ||
      !Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng) ||
      !Number.isFinite(dest.lat) || !Number.isFinite(dest.lng) ||
      Math.abs(pickup.lat) > 90 || Math.abs(pickup.lng) > 180 ||
      Math.abs(dest.lat) > 90 || Math.abs(dest.lng) > 180
    ) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    try {
      const { route, fallback } = await calculateRouteDistance(pickup, dest);
      return NextResponse.json({ ...route, fallback });
    } catch {
      return NextResponse.json(
        { error: "We couldn't calculate the route right now. Please try again in a moment." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Geo route error:", error);
    return NextResponse.json({ error: "Route calculation failed" }, { status: 500 });
  }
}