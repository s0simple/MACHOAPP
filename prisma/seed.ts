import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Simple branded placeholder for demo vehicles (distinct color per type).
function vehiclePlaceholderSvg(label: string, bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="${bg}"/>
  <g transform="translate(160,110)">
    <rect x="0" y="40" width="240" height="140" rx="12" fill="#ffffff" opacity="0.95"/>
    <path d="M240 80h90l60 60v40h-150z" fill="#ffffff" opacity="0.95"/>
    <circle cx="80" cy="200" r="30" fill="#1f2937"/>
    <circle cx="80" cy="200" r="12" fill="${bg}"/>
    <circle cx="300" cy="200" r="30" fill="#1f2937"/>
    <circle cx="300" cy="200" r="12" fill="${bg}"/>
  </g>
  <text x="320" y="430" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text>
</svg>`;
}

function uploadSvg(svg: string, publicId: string): Promise<{ secureUrl: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "image" },
      (error, result) =>
        error || !result
          ? reject(error ?? new Error("Cloudinary upload failed"))
          : resolve({ secureUrl: result.secure_url, publicId: result.public_id })
    );
    stream.end(Buffer.from(svg, "utf8"));
  });
}

/**
 * Give a demo vehicle its main image (uploaded to Cloudinary) if it has none.
 * Skips gracefully when Cloudinary is not configured or unreachable.
 */
async function ensureVehicleImage(
  vehicle: { id: string; make: string; model: string },
  label: string,
  bg: string
) {
  const existing = await prisma.vehicleImage.findFirst({
    where: { vehicleId: vehicle.id },
  });
  if (existing) return;

  if (!process.env.CLOUDINARY_URL) {
    console.warn(`Skipping image for ${vehicle.make} ${vehicle.model} — CLOUDINARY_URL not set`);
    return;
  }

  const url = new URL(process.env.CLOUDINARY_URL);
  cloudinary.config({
    cloud_name: url.hostname,
    api_key: url.username,
    api_secret: url.password,
  });

  try {
    const svg = vehiclePlaceholderSvg(label, bg);
    const { secureUrl, publicId } = await uploadSvg(
      svg,
      `kalumalu/vehicle-images/${vehicle.id}-seed-main`
    );
    await prisma.vehicleImage.create({
      data: {
        vehicleId: vehicle.id,
        url: secureUrl,
        publicId,
        isMain: true,
        sortOrder: 0,
      },
    });
    console.log(`Created main image for ${vehicle.make} ${vehicle.model}`);
  } catch (error) {
    console.warn(`Could not create image for ${vehicle.make} ${vehicle.model}:`, error);
  }
}

async function main() {
  console.log("Seeding database...");

  // Create Vehicle Types — Abossey Okai Macho mini-trucks only
  // (SMALL → MEDIUM → LARGE, all mini-truck sizes).
  const miniTruckSmall = await prisma.vehicleType.upsert({
    where: { name: "Mini Truck Small" },
    update: {},
    create: {
      name: "Mini Truck Small",
      description: "Mini truck (SMALL) for loads up to 1 ton",
    },
  });

  const miniTruckMedium = await prisma.vehicleType.upsert({
    where: { name: "Mini Truck Medium" },
    update: {},
    create: {
      name: "Mini Truck Medium",
      description: "Mini truck (MEDIUM) for loads up to 2 tons",
    },
  });

  const miniTruckLarge = await prisma.vehicleType.upsert({
    where: { name: "Mini Truck Large" },
    update: {},
    create: {
      name: "Mini Truck Large",
      description: "Mini truck (LARGE) for loads up to 5 tons",
    },
  });

  // Create Pricing Rules (one per mini-truck size)
  await prisma.pricingRule.upsert({
    where: { id: "pricing-mini-small" },
    update: {},
    create: {
      id: "pricing-mini-small",
      vehicleTypeId: miniTruckSmall.id,
      baseRate: 50,
      perKmRate: 3.5,
      perKgRate: 0.15,
      minPrice: 80,
      surgeMultiplier: 1.0,
      isActive: true,
    },
  });

  await prisma.pricingRule.upsert({
    where: { id: "pricing-mini-medium" },
    update: {},
    create: {
      id: "pricing-mini-medium",
      vehicleTypeId: miniTruckMedium.id,
      baseRate: 80,
      perKmRate: 4.0,
      perKgRate: 0.12,
      minPrice: 120,
      surgeMultiplier: 1.0,
      isActive: true,
    },
  });

  await prisma.pricingRule.upsert({
    where: { id: "pricing-mini-large" },
    update: {},
    create: {
      id: "pricing-mini-large",
      vehicleTypeId: miniTruckLarge.id,
      baseRate: 120,
      perKmRate: 5.0,
      perKgRate: 0.10,
      minPrice: 180,
      surgeMultiplier: 1.0,
      isActive: true,
    },
  });

  // Create Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@kalumalu.com" },
    update: {},
    create: {
      name: "MACHO App Admin",
      email: "admin@kalumalu.com",
      emailVerified: true,
      role: "admin",
    },
  });

  // Create Demo Users
  const passengerUser = await prisma.user.upsert({
    where: { email: "passenger@demo.com" },
    update: {},
    create: {
      name: "Kwame Asante",
      email: "passenger@demo.com",
      emailVerified: true,
      role: "passenger",
    },
  });

  const passenger = await prisma.passenger.upsert({
    where: { userId: passengerUser.id },
    update: {},
    create: {
      userId: passengerUser.id,
      phone: "+233 24 123 4567",
    },
  });

  // Create Demo Drivers
  const driver1User = await prisma.user.upsert({
    where: { email: "driver1@demo.com" },
    update: {},
    create: {
      name: "Yaw Mensah",
      email: "driver1@demo.com",
      emailVerified: true,
      role: "driver",
    },
  });

  const driver1 = await prisma.driver.upsert({
    where: { userId: driver1User.id },
    update: {},
    create: {
      userId: driver1User.id,
      phone: "+233 20 987 6543",
      licenseNumber: "DL-2024-001234",
      rating: 4.7,
      totalTrips: 156,
      isAvailable: true,
      isApproved: true,
      currentLat: 5.5600,
      currentLng: -0.2050,
    },
  });

  const driver2User = await prisma.user.upsert({
    where: { email: "driver2@demo.com" },
    update: {},
    create: {
      name: "Kofi Addo",
      email: "driver2@demo.com",
      emailVerified: true,
      role: "driver",
    },
  });

  const driver2 = await prisma.driver.upsert({
    where: { userId: driver2User.id },
    update: {},
    create: {
      userId: driver2User.id,
      phone: "+233 27 555 1234",
      licenseNumber: "DL-2024-005678",
      rating: 4.5,
      totalTrips: 89,
      isAvailable: true,
      isApproved: true,
      currentLat: 5.6037,
      currentLng: -0.1870,
    },
  });

  const driver3User = await prisma.user.upsert({
    where: { email: "driver3@demo.com" },
    update: {},
    create: {
      name: "Ama Osei",
      email: "driver3@demo.com",
      emailVerified: true,
      role: "driver",
    },
  });

  const driver3 = await prisma.driver.upsert({
    where: { userId: driver3User.id },
    update: {},
    create: {
      userId: driver3User.id,
      phone: "+233 24 777 8899",
      licenseNumber: "DL-2024-009012",
      rating: 4.9,
      totalTrips: 312,
      isAvailable: true,
      isApproved: true,
      currentLat: 5.5500,
      currentLng: -0.2200,
    },
  });

  // Create Vehicles
  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNumber: "GR 1234-20" },
    update: {},
    create: {
      driverId: driver1.id,
      typeId: miniTruckLarge.id,
      make: "Isuzu",
      model: "NPR",
      year: 2020,
      registrationNumber: "GR 1234-20",
      capacity: 4000,
      length: 4.8,
      width: 2.0,
      height: 2.2,
      status: "available",
      isVerified: true,
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { registrationNumber: "GW 5678-21" },
    update: {},
    create: {
      driverId: driver2.id,
      typeId: miniTruckMedium.id,
      make: "Toyota",
      model: "Dyna",
      year: 2021,
      registrationNumber: "GW 5678-21",
      capacity: 1800,
      length: 4.2,
      width: 1.8,
      height: 2.0,
      status: "available",
      isVerified: true,
    },
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { registrationNumber: "GT 9012-19" },
    update: {},
    create: {
      driverId: driver3.id,
      typeId: miniTruckSmall.id,
      make: "Toyota",
      model: "Hiace",
      year: 2019,
      registrationNumber: "GT 9012-19",
      capacity: 800,
      length: 3.5,
      width: 1.6,
      height: 1.8,
      status: "available",
      isVerified: true,
    },
  });

  // Give each demo vehicle a main image (uploaded to Cloudinary).
  await ensureVehicleImage(vehicle1, "Mini Truck Large", "#2563eb");
  await ensureVehicleImage(vehicle2, "Mini Truck Medium", "#f59e0b");
  await ensureVehicleImage(vehicle3, "Mini Truck Small", "#059669");

  // Create a demo request (only once — no unique key to upsert on)
  const existingDemoRequest = await prisma.transportationRequest.findFirst({
    where: { pickupAddress: "Accra Mall, Spintex Road" },
  });

  if (!existingDemoRequest) {
    await prisma.transportationRequest.create({
      data: {
        passengerId: passenger.id,
        pickupAddress: "Accra Mall, Spintex Road",
        pickupLat: 5.6037,
        pickupLng: -0.1870,
        destAddress: "Kumasi Central Market",
        destLat: 6.6885,
        destLng: -1.6244,
        goodsType: "General Goods",
        goodsDescription: "Electronics and accessories for shop",
        weight: 500,
        length: 2.0,
        width: 1.5,
        height: 1.2,
        quantity: 10,
        isFragile: true,
        distance: 248,
        estimatedPrice: 485.5,
        status: "pending",
      },
    });
  }

  console.log("Database seeded successfully!");
  console.log("Demo accounts:");
  console.log("  Admin:    admin@kalumalu.com (MACHO App Admin)");
  console.log("  Passenger: passenger@demo.com");
  console.log("  Driver 1: driver1@demo.com (Yaw Mensah)");
  console.log("  Driver 2: driver2@demo.com (Kofi Addo)");
  console.log("  Driver 3: driver3@demo.com (Ama Osei)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
