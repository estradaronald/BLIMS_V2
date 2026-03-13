// src/config/db.js
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URL;

  if (!uri) {
    console.error("❌ Missing MONGO_URL in your .env file");
    process.exit(1);
  }

  try {
    // Recommended defaults
    mongoose.set("strictQuery", true);

    // Optional: log queries when debugging
    if (process.env.MONGO_DEBUG === "true") {
      mongoose.set("debug", true);
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000, // fail fast if Mongo is down
      connectTimeoutMS: 15000,
    });

    const dbName = mongoose.connection?.name || "unknown";
    const host = mongoose.connection?.host || "unknown";

    console.log(`✅ MongoDB connected: ${host} / ${dbName}`);

    // Graceful shutdown (Ctrl+C)
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🛑 MongoDB connection closed (SIGINT)");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

module.exports = connectDB;