import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { deriveVehicleTypeName } from "@/lib/constants";

/** Returns true when the session user may manage this vehicle (owner driver or admin). */
async function canManageVehicle(userId: string, role: string | undefined, driverId: string) {
  if (role === "admin") return true;
  const driver = await prisma.driver.findUnique({ where: { userId } });
  return !!driver && driver.id === driverId;
}

// PATCH /api/vehicles/[id] — the owning driver edits their vehicle (admins can edit any).
export async function PATCH(
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

    const { id } = await params;
    const body = await request.json();
    const { make, model, year, registrationNumber, capacity, color, length, width, height, hasRefrigeration } = body;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    if (!(await canManageVehicle(session.user.id, session.user.role, vehicle.driverId))) {
      return NextResponse.json(
        { error: "You can only edit your own vehicles" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};

    if (make !== undefined) {
      const trimmed = String(make).trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Make is required" }, { status: 400 });
      }
      data.make = trimmed;
    }

    if (model !== undefined) {
      const trimmed = String(model).trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Model is required" }, { status: 400 });
      }
      data.model = trimmed;
    }

    if (year !== undefined) {
      if (year === "" || year === null) {
        data.year = null;
      } else {
        const parsedYear = parseInt(year);
        if (isNaN(parsedYear)) {
          return NextResponse.json({ error: "Year must be a valid number" }, { status: 400 });
        }
        data.year = parsedYear;
      }
    }

    let keySpecChanged = false;

    if (registrationNumber !== undefined && String(registrationNumber).trim() !== vehicle.registrationNumber) {
      const reg = String(registrationNumber).trim().toUpperCase();
      if (!reg) {
        return NextResponse.json({ error: "Registration number is required" }, { status: 400 });
      }
      const existing = await prisma.vehicle.findUnique({ where: { registrationNumber: reg } });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Vehicle with this registration number already exists" },
          { status: 409 }
        );
      }
      data.registrationNumber = reg;
      keySpecChanged = true;
    }

    if (capacity !== undefined) {
      const parsedCapacity = parseFloat(capacity);
      if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
        return NextResponse.json({ error: "Capacity must be a positive number" }, { status: 400 });
      }
      data.capacity = parsedCapacity;
      if (parsedCapacity !== vehicle.capacity) keySpecChanged = true;

      // The vehicle type always derives from the capacity (SMALL → MEDIUM → LARGE).
      const typeName = deriveVehicleTypeName(parsedCapacity);
      const type = await prisma.vehicleType.findUnique({ where: { name: typeName } });
      if (!type) {
        return NextResponse.json(
          { error: `Vehicle type "${typeName}" is not configured. Please contact support.` },
          { status: 400 }
        );
      }
      data.typeId = type.id;
    }

    if (color !== undefined) {
      const trimmed = String(color).trim();
      data.color = trimmed === "" ? null : trimmed;
    }

    const dimensionFields: [string, string | null | undefined][] = [
      ["length", length],
      ["width", width],
      ["height", height],
    ];
    for (const [field, value] of dimensionFields) {
      if (value !== undefined) {
        if (value === "" || value === null) {
          data[field] = null;
        } else {
          const parsed = parseFloat(String(value));
          if (isNaN(parsed)) {
            return NextResponse.json(
              { error: `${field.charAt(0).toUpperCase() + field.slice(1)} must be a valid number` },
              { status: 400 }
            );
          }
          data[field] = parsed;
        }
      }
    }

    if (hasRefrigeration !== undefined) {
      data.hasRefrigeration = Boolean(hasRefrigeration);
    }

    // Identity/spec changes on a verified vehicle require admin re-verification.
    const needsReverification = keySpecChanged && vehicle.isVerified;
    if (needsReverification) {
      data.isVerified = false;
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data,
    });

    // Tell admins to re-verify a previously verified vehicle after key spec changes.
    if (needsReverification) {
      const admins = await prisma.user.findMany({ where: { role: "admin" } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: "system",
            title: "Vehicle Updated",
            message: `${updated.make} ${updated.model} (${updated.registrationNumber}) was edited and requires re-verification.`,
            link: "/dashboard/vehicles",
          },
        });
      }
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Update vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

// DELETE /api/vehicles/[id] — the owning driver deletes their vehicle (admins can delete any).
export async function DELETE(
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

    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    if (!(await canManageVehicle(session.user.id, session.user.role, vehicle.driverId))) {
      return NextResponse.json(
        { error: "You can only delete your own vehicles" },
        { status: 403 }
      );
    }

    // Keep trip history intact: block deletion if the vehicle has any trips.
    const tripCount = await prisma.trip.count({ where: { vehicleId: id } });
    if (tripCount > 0) {
      return NextResponse.json(
        { error: "This vehicle has trip history and cannot be deleted." },
        { status: 409 }
      );
    }

    // Detach the vehicle from any requests that picked it as preferred.
    await prisma.transportationRequest.updateMany({
      where: { preferredVehicleId: id },
      data: { preferredVehicleId: null },
    });

    await prisma.vehicle.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 }
    );
  }
}