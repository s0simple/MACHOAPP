import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { deleteVehicleImage, uploadVehicleImage } from "@/lib/cloudinary";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const vehicleId = formData.get("vehicleId") as string | null;
    const files = formData.getAll("images").filter((f): f is File => f instanceof File);

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Missing vehicleId" },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No image files provided" },
        { status: 400 }
      );
    }

    if (files.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 images per upload" },
        { status: 400 }
      );
    }

    // Only the owning driver (or an admin) may add images to a vehicle.
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { driver: { select: { userId: true } } },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    const isOwner = vehicle.driver.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You can only upload images for your own vehicles" },
        { status: 403 }
      );
    }

    // Validate files
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Use JPEG, PNG or WebP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Max size is 5MB.` },
          { status: 400 }
        );
      }
    }

    const currentCount = await prisma.vehicleImage.count({ where: { vehicleId } });

    const created: { id: string; url: string }[] = [];
    let sortOrder = currentCount;

    for (const file of files) {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filename = `${vehicleId}-${crypto.randomUUID()}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to Cloudinary — persists across redeploys and works on any host.
      const { secureUrl, publicId } = await uploadVehicleImage(buffer, filename);

      const image = await prisma.vehicleImage.create({
        data: {
          vehicleId,
          url: secureUrl,
          publicId,
          // The first image for a vehicle automatically becomes its main image.
          isMain: currentCount === 0,
          sortOrder: sortOrder++,
        },
      });
      created.push({ id: image.id, url: image.url });
    }

    return NextResponse.json({ images: created }, { status: 201 });
  } catch (error) {
    console.error("Vehicle image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload images" },
      { status: 500 }
    );
  }
}

// PATCH /api/vehicle-images — set an image as the vehicle's main image.
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { imageId } = body;

    if (!imageId || typeof imageId !== "string") {
      return NextResponse.json(
        { error: "Missing imageId" },
        { status: 400 }
      );
    }

    const image = await prisma.vehicleImage.findUnique({
      where: { id: imageId },
      include: { vehicle: { include: { driver: { select: { userId: true } } } } },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const isOwner = image.vehicle.driver.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You can only manage images for your own vehicles" },
        { status: 403 }
      );
    }

    // Clear the main flag on all images for this vehicle, then set it on the chosen one.
    await prisma.vehicleImage.updateMany({
      where: { vehicleId: image.vehicleId },
      data: { isMain: false },
    });
    const updated = await prisma.vehicleImage.update({
      where: { id: imageId },
      data: { isMain: true },
    });

    return NextResponse.json({ success: true, image: updated }, { status: 200 });
  } catch (error) {
    console.error("Set main image error:", error);
    return NextResponse.json(
      { error: "Failed to set main image" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("id");

    if (!imageId) {
      return NextResponse.json({ error: "Missing image id" }, { status: 400 });
    }

    const image = await prisma.vehicleImage.findUnique({
      where: { id: imageId },
      include: { vehicle: { include: { driver: { select: { userId: true } } } } },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const isOwner = image.vehicle.driver.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You can only delete images for your own vehicles" },
        { status: 403 }
      );
    }

    // Remove the asset from Cloudinary first. Legacy filesystem-only rows
    // have no publicId and are skipped.
    if (image.publicId) {
      try {
        await deleteVehicleImage(image.publicId);
      } catch (cloudinaryError) {
        // Don't block the DB delete if the Cloudinary cleanup fails.
        console.warn("Failed to delete Cloudinary asset:", cloudinaryError);
      }
    }

    await prisma.vehicleImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Vehicle image delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}