import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  CANCELLABLE_REQUEST_STATUSES,
  MAX_CANCELLATION_NOTE_LENGTH,
} from "@/lib/constants";

/**
 * Cancel a transportation request.
 *
 * Policy: a passenger may cancel ONLY while the request is still "pending"
 * (no driver has accepted it). Once a driver accepts, a Trip is created and
 * the customer can no longer withdraw the order. The status guard is applied
 * atomically so a customer cancel can never race a driver accept.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Only passengers may cancel their own requests.
    if (session.user.role !== "passenger") {
      return NextResponse.json(
        { error: "Only passengers can cancel transportation requests" },
        { status: 403 }
      );
    }

    const passenger = await prisma.passenger.findUnique({
      where: { userId: session.user.id },
    });
    if (!passenger) {
      return NextResponse.json(
        { error: "Passenger profile not found" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Optional cancellation reason + note. Reason is stored as
    // "Reason — note" text so a single column captures both.
    let body: { reason?: unknown; note?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";
    const note =
      typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > MAX_CANCELLATION_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Note must be under ${MAX_CANCELLATION_NOTE_LENGTH} characters` },
        { status: 400 }
      );
    }
    const cancelReason =
      reason && note ? `${reason} — ${note}` : reason || note || null;

    const existing = await prisma.transportationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        passengerId: true,
        status: true,
        preferredVehicleId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Ownership is enforced server-side; never trust a client-supplied id.
    if (existing.passengerId !== passenger.id) {
      return NextResponse.json(
        { error: "You can only cancel your own requests" },
        { status: 403 }
      );
    }

    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "This request has already been cancelled" },
        { status: 409 }
      );
    }

    if (!CANCELLABLE_REQUEST_STATUSES.includes(existing.status as "pending")) {
      // Covers accepted / in_transit / completed — a driver is involved and
      // the customer may no longer withdraw the order.
      return NextResponse.json(
        {
          error:
            "This order can no longer be cancelled because a driver has already accepted it.",
        },
        { status: 409 }
      );
    }

    // Atomic conditional update: transitions to "cancelled" only if the
    // request is STILL pending. If a driver accepted between our read and
    // this write, count === 0 and nothing changes.
    const result = await prisma.transportationRequest.updateMany({
      where: { id, status: "pending" },
      data: {
        status: "cancelled",
        cancelReason,
        cancelledAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        {
          error:
            "This order can no longer be cancelled because a driver has already accepted it.",
        },
        { status: 409 }
      );
    }

    const updatedRequest = await prisma.transportationRequest.findUnique({
      where: { id },
    });

    // Notify the driver only when the passenger had chosen their truck;
    // broadcast requests have no single recipient to tell.
    if (existing.preferredVehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: existing.preferredVehicleId },
        select: { driver: { select: { userId: true } } },
      });
      if (vehicle?.driver?.userId) {
        await prisma.notification.create({
          data: {
            userId: vehicle.driver.userId,
            type: "request_cancelled",
            title: "Request Withdrawn",
            message: cancelReason
              ? `A passenger withdrew their request. Reason: ${cancelReason}.`
              : "A passenger withdrew a request that was sent to your truck.",
            link: "/dashboard/requests",
          },
        });
      }
    }

    return NextResponse.json({ request: updatedRequest }, { status: 200 });
  } catch (error) {
    console.error("Cancel request error:", error);
    return NextResponse.json(
      { error: "Failed to cancel request" },
      { status: 500 }
    );
  }
}