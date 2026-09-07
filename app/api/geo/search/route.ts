import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { searchPlaces } from "@/lib/geo";

/**
 * Authenticated proxy for Nominatim place search. Requests are throttled and
 * cached server-side (see lib/geo.ts) to respect the public Nominatim policy;
 * clients must debounce before calling this endpoint.
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 3) {
      return NextResponse.json({ results: [] });
    }

    try {
      const results = await searchPlaces(q, 5);
      return NextResponse.json({ results });
    } catch {
      // Upstream geocoder failed — degrade gracefully, never expose raw errors.
      return NextResponse.json(
        { results: [], error: "Address search is temporarily unavailable. Please try again in a moment." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Geo search error:", error);
    return NextResponse.json({ error: "Address search failed" }, { status: 500 });
  }
}