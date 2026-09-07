const { PrismaClient } = require("./lib/generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const cs = process.env.DATABASE_URL;
if (!cs) {
  console.log("No DATABASE_URL set");
  process.exit(0);
}

const adapter = new PrismaPg({ connectionString: cs });
const prisma = new PrismaClient({ adapter });

prisma.vehicleType
  .findMany({ select: { id: true, name: true } })
  .then((types) => {
    console.log("Vehicle types in DB:");
    types.forEach((t) => console.log("  -", t.name));
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error("DB error:", e.message);
    process.exit(1);
  });
