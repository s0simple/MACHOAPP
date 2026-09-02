import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create Vehicle Types
  const miniTruck = await prisma.vehicleType.upsert({
    where: { name: "Mini Truck" },
    update: {},
    create: {
      name: "Mini Truck",
      description: "Small truck for light loads up to 2 tons",
    },
  });

  const cargoTruck = await prisma.vehicleType.upsert({
    where: { name: "Cargo Truck" },
    update: {},
    create: {
      name: "Cargo Truck",
      description: "Medium truck for loads up to 5 tons",
    },
  });

  const containerTruck = await prisma.vehicleType.upsert({
    where: { name: "Container Truck" },
    update: {},
    create: {
      name: "Container Truck",
      description: "Large truck for heavy loads up to 20 tons",
    },
  });

  // Create Pricing Rules
  await prisma.pricingRule.upsert({
    where: { id: "pricing-mini" },
    update: {},
    create: {
      id: "pricing-mini",
      vehicleTypeId: miniTruck.id,
      baseRate: 50,
      perKmRate: 3.5,
      perKgRate: 0.15,
      minPrice: 80,
      surgeMultiplier: 1.0,
      isActive: true,
    },
  });

  await prisma.pricingRule.upsert({
    where: { id: "pricing-cargo" },
    update: {},
    create: {
      id: "pricing-cargo",
      vehicleTypeId: cargoTruck.id,
      baseRate: 100,
      perKmRate: 5.0,
      perKgRate: 0.10,
      minPrice: 150,
      surgeMultiplier: 1.0,
      isActive: true,
    },
  });

  await prisma.pricingRule.upsert({
    where: { id: "pricing-container" },
    update: {},
    create: {
      id: "pricing-container",
      vehicleTypeId: containerTruck.id,
      baseRate: 200,
      perKmRate: 8.0,
      perKgRate: 0.08,
      minPrice: 350,
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
  await prisma.vehicle.upsert({
    where: { registrationNumber: "GR 1234-20" },
    update: {},
    create: {
      driverId: driver1.id,
      typeId: cargoTruck.id,
      make: "Isuzu",
      model: "NPR",
      year: 2020,
      registrationNumber: "GR 1234-20",
      capacity: 5000,
      length: 6.0,
      width: 2.2,
      height: 2.5,
      status: "available",
      isVerified: true,
    },
  });

  await prisma.vehicle.upsert({
    where: { registrationNumber: "GW 5678-21" },
    update: {},
    create: {
      driverId: driver2.id,
      typeId: miniTruck.id,
      make: "Toyota",
      model: "Dyna",
      year: 2021,
      registrationNumber: "GW 5678-21",
      capacity: 2000,
      length: 4.5,
      width: 1.8,
      height: 2.0,
      status: "available",
      isVerified: true,
    },
  });

  await prisma.vehicle.upsert({
    where: { registrationNumber: "GT 9012-19" },
    update: {},
    create: {
      driverId: driver3.id,
      typeId: containerTruck.id,
      make: "Sinotruk",
      model: "Howo",
      year: 2019,
      registrationNumber: "GT 9012-19",
      capacity: 20000,
      length: 12.0,
      width: 2.5,
      height: 3.8,
      status: "available",
      isVerified: true,
    },
  });

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