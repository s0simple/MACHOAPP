import { NextResponse } from "next/server";
import { findMatchingTrucks } from "@/lib/matching";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { pickupLat, pickupLng, destLat, destLng, weight } = body;

    if (!pickupLat || !pickupLng || !destLat || !destLng || !weight) {
      return NextResponse.json(
        { error: "Missing required fields: pickupLat, pickupLng, destLat, destLng, weight" },
        { status: 400 }
      );
    }

    const matches = await findMatchingTrucks({
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      destLat: parseFloat(destLat),
      destLng: parseFloat(destLng),
      weight: parseFloat(weight),
      preferredVehicleType: body.preferredVehicleType,
      isFragile: body.isFragile || false,
      needsRefrigeration: body.needsRefrigeration || false,
    });

    return NextResponse.json({ matches }, { status: 200 });
  } catch (error) {
    console.error("Matching error:", error);
    return NextResponse.json(
      { error: "Failed to find matching trucks" },
      { status: 500 }
    );
  }
}