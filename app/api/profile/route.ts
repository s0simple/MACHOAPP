import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Phone numbers are shared between a passenger and their assigned driver so
// the two can call each other off-app. Stored on the role profile
// (Passenger.phone / Driver.phone), never on the User row.
const MAX_PHONE_LENGTH = 30;

// Basic Ghana-friendly validation: digits, spaces, +, -, ( and ) only, with
// at least 7 digits. Deliberately permissive to accept local formats.
function normalizePhone(value: unknown): string | null | undefined {
  if (value === undefined) return undefined; // field not provided
  if (value === null) return null; // explicit clear
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_PHONE_LENGTH) return undefined;
  if (!/^[0-9+\-() ]+$/.test(trimmed)) return undefined;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return undefined;
  return trimmed;
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = session.user.id;
    let phone: string | null = null;

    if (session.user.role === "driver") {
      const driver = await prisma.driver.findUnique({
        where: { userId },
        select: { phone: true },
      });
      phone = driver?.phone ?? null;
    } else {
      const passenger = await prisma.passenger.findUnique({
        where: { userId },
        select: { phone: true },
      });
      phone = passenger?.phone ?? null;
    }

    return NextResponse.json({ phone }, { status: 200 });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let body: { phone?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const phone = normalizePhone(body.phone);
    if (phone === undefined) {
      return NextResponse.json(
        { error: `Enter a valid phone number (up to ${MAX_PHONE_LENGTH} characters)` },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Upsert so this also works for accounts created before phone collection
    // existed and whose role profile may be missing.
    if (session.user.role === "driver") {
      await prisma.driver.upsert({
        where: { userId },
        update: { phone },
        create: { userId, phone },
      });
    } else if (session.user.role === "passenger") {
      await prisma.passenger.upsert({
        where: { userId },
        update: { phone },
        create: { userId, phone },
      });
    } else {
      return NextResponse.json(
        { error: "Only passengers and drivers have a phone number" },
        { status: 403 }
      );
    }

    return NextResponse.json({ phone }, { status: 200 });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}