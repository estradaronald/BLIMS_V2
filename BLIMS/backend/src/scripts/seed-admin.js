
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
});
const { MongoClient } = require("mongodb");
const argon2 = require("argon2");

async function seedAdmin() {
  const username = "admin@school.com";
  const password = "Admin123!"; // change if you want

  if (!process.env.MONGO_URL) {
    console.error("❌ MONGO_URL not found in .env");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGO_URL);

  try {
    await client.connect();
    const db = client.db("school_db");
    const users = db.collection("users");

    // prevent duplicate admin
    const existing = await users.findOne({ username });
    if (existing) {
      console.log("❌ Admin already exists.");
      process.exit();
    }

    const password_hash = await argon2.hash(password);

    await users.insertOne({
      username,
      role: "admin",
      password_hash,
      must_change_password: false, // ✅ no forced change
      password_changed_at: new Date(),
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    });

    await users.createIndex({ username: 1 }, { unique: true });

    console.log("✅ Admin seeded successfully!");
    console.log("Username:", username);
    console.log("Password:", password);
    console.log("You can login immediately.");

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

seedAdmin();