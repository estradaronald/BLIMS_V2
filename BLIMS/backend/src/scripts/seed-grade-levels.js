const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const connectDB = require("../config/db");
const GradeLevel = require("../models/GradeLevel.model");

const DEFAULT_GRADES = [
  "Kinder",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
];

(async () => {
  try {
    await connectDB();

    for (const grade of DEFAULT_GRADES) {
      const exists = await GradeLevel.findOne({ grade }).lean();
      if (!exists) {
        await GradeLevel.create({
          grade,
          subjects: [],
          isActive: true,
        });
        console.log(`✅ Added ${grade}`);
      } else {
        console.log(`⏭️ Exists: ${grade}`);
      }
    }

    console.log("🎉 Grade levels seeded.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
})();