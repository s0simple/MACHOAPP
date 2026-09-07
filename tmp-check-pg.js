require("dotenv/config");
const { Client } = require("pg");

const cs = process.env.DATABASE_URL;
if (!cs) {
  console.log("No DATABASE_URL set");
  process.exit(0);
}

const client = new Client({ connectionString: cs });

client
  .connect()
  .then(() => client.query('SELECT name FROM "vehicle_types" ORDER BY name'))
  .then((res) => {
    console.log("Vehicle types in DB:");
    res.rows.forEach((r) => console.log("  -", r.name));
    return client.end();
  })
  .catch((e) => {
    console.error("DB error:", e.message);
    process.exit(1);
  });
