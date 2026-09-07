require("dotenv/config");
const { Client } = require("pg");

const cs = process.env.DATABASE_URL;
if (!cs) {
  console.log("No DATABASE_URL set");
  process.exit(1);
}

const client = new Client({ connectionString: cs });

async function main() {
  await client.connect();

  // Insert the three mini-truck types if they don't exist
  const types = [
    { name: "Mini Truck Small", description: "Mini truck (SMALL) for loads up to 1 ton" },
    { name: "Mini Truck Medium", description: "Mini truck (MEDIUM) for loads up to 2 tons" },
    { name: "Mini Truck Large", description: "Mini truck (LARGE) for loads up to 5 tons" },
  ];

  for (const t of types) {
    const existing = await client.query('SELECT id FROM "vehicle_types" WHERE name = $1', [t.name]);
    if (existing.rows.length === 0) {
      await client.query(
        'INSERT INTO "vehicle_types" (id, name, description, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())',
        [t.name, t.description]
      );
      console.log(`Created: ${t.name}`);
    } else {
      console.log(`Already exists: ${t.name}`);
    }
  }

  // List all types
  const res = await client.query('SELECT name FROM "vehicle_types" ORDER BY name');
  console.log("\nAll vehicle types in DB:");
  res.rows.forEach((r) => console.log("  -", r.name));

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
