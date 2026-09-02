const mongoose = require("mongoose");
const Section = require("../models/Section");
const GradeLevel = require("../models/GradeLevel.model");
const Teacher = require("../models/Teacher.model");

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

function serverError(res, err) {
  console.error("❌ GradeLevels controller error:", err);
  return res.status(500).json({ ok: false, message: "Server error" });
}

exports.getGrades = async (req, res) => {
  try {
    const rows = await GradeLevel.find({ isActive: true })
      .sort({ createdAt: 1, grade: 1 })
      .lean();

    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: String(r._id),
        grade: r.grade,
        subjects: Array.isArray(r.subjects) ? r.subjects : [],
      })),
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.createGrade = async (req, res) => {
  try {
    const grade = String(req.body?.grade || "").trim();
    if (!grade) return badRequest(res, "Grade level name is required.");

    const exists = await GradeLevel.findOne({
      grade: {
        $regex: `^${grade.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
      isActive: true,
    }).lean();

    if (exists) {
      return res.status(409).json({ ok: false, message: "Grade level already exists." });
    }

    const doc = await GradeLevel.create({
      grade,
      subjects: [],
      isActive: true,
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: String(doc._id),
        grade: doc.grade,
        subjects: doc.subjects || [],
      },
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.deleteGrade = async (req, res) => {
  try {
    const { gradeLevelId } = req.params;

    const gradeDoc = await GradeLevel.findById(gradeLevelId);
    if (!gradeDoc) {
      return res.status(404).json({ ok: false, message: "Grade level not found." });
    }

    const linkedSections = await Section.countDocuments({
      grade: gradeDoc.grade,
      isActive: { $ne: false },
    });

    if (linkedSections > 0) {
      return res.status(409).json({
        ok: false,
        message: "Cannot delete grade level because it still has sections.",
      });
    }

    await GradeLevel.findByIdAndDelete(gradeLevelId);

    return res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.getSummary = async (req, res) => {
  try {
    const grades = await GradeLevel.find({ isActive: true })
      .sort({ createdAt: 1, grade: 1 })
      .lean();

    const agg = await Section.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$grade" } } },
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    for (const r of agg) {
      countMap[String(r._id || "").trim().toLowerCase()] = r.count;
    }

    const out = {};
    for (const g of grades) {
      out[g.grade] = Number(countMap[norm(g.grade)] || 0);
    }

    return res.json({ ok: true, data: out });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.listSections = async (req, res) => {
  try {
    const { grade, q, capacityFilter = "all" } = req.query;

    const query = { isActive: { $ne: false } };

    if (grade !== undefined) {
      const g = String(grade).trim();

      const exists = await GradeLevel.findOne({ grade: g, isActive: true }).lean();
      if (!exists) return badRequest(res, "Invalid request.");

      query.grade = g;
    }

    if (q && String(q).trim()) {
      const nq = norm(q);
      query.$or = [
        { sectionNorm: { $regex: nq, $options: "i" } },
        { adviserNorm: { $regex: nq, $options: "i" } },
      ];
    }

    if (capacityFilter === "lt30") query.capacity = { $lt: 30 };
    else if (capacityFilter === "30to40") query.capacity = { $gte: 30, $lte: 40 };
    else if (capacityFilter === "gt40") query.capacity = { $gt: 40 };
    else if (capacityFilter !== "all") return badRequest(res, "Invalid request.");

    const rows = await Section.find(query)
      .sort({ grade: 1, sectionNorm: 1, createdAt: 1 })
      .lean();

    const out = rows.map((r) => ({
      id: String(r._id),
      grade: r.grade,
      section: r.section,
      adviserId: r.adviserId ? String(r.adviserId) : "",
      adviser: r.adviser || "",
      capacity: r.capacity,
      createdAt: r.createdAt,
    }));

    return res.json({ ok: true, data: out });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.createSection = async (req, res) => {
  try {
    const {
      grade,
      section,
      adviserId = "",
      adviser = "",
      capacity,
    } = req.body || {};

    const g = String(grade || "").trim();
    const s = String(section || "").trim();
    const advId = String(adviserId || "").trim();
    let advName = String(adviser || "").trim();

    const gradeExists = await GradeLevel.findOne({ grade: g, isActive: true }).lean();
    if (!gradeExists) return badRequest(res, "Invalid request.");
    if (!s) return badRequest(res, "Invalid request.");

    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) return badRequest(res, "Invalid request.");

    const duplicate = await Section.findOne({
      grade: g,
      sectionNorm: norm(s),
      isActive: { $ne: false },
    }).lean();

    if (duplicate) {
      return res.status(409).json({ ok: false, message: "Section already exists." });
    }

    let teacher = null;

    if (advId) {
      if (!mongoose.Types.ObjectId.isValid(advId)) {
        return badRequest(res, "Invalid request.");
      }

      teacher = await Teacher.findById(advId).lean();
      if (!teacher || teacher.isActive === false) {
        return badRequest(res, "Invalid request.");
      }

      const usedByOtherSection = await Section.findOne({
        adviserId: teacher._id,
        isActive: { $ne: false },
      }).lean();

      if (usedByOtherSection) {
        return res.status(409).json({
          ok: false,
          message: "Teacher is already assigned to another section.",
        });
      }

      advName =
        advName ||
        [teacher.firstName, teacher.middleName, teacher.lastName]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
    } else {
      advName = "";
    }

    const doc = await Section.create({
      grade: g,
      section: s,
      sectionNorm: norm(s),
      adviserId: teacher?._id || null,
      adviser: advName,
      adviserNorm: norm(advName),
      capacity: cap,
      isActive: true,
    });

    if (teacher?._id) {
      await Teacher.findByIdAndUpdate(teacher._id, {
        $set: {
          className: g,
          sectionName: s,
        },
      });
    }

    return res.status(201).json({
      ok: true,
      data: {
        id: String(doc._id),
        grade: doc.grade,
        section: doc.section,
        adviserId: String(doc.adviserId || ""),
        adviser: doc.adviser || "",
        capacity: doc.capacity,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ ok: false, message: "Section already exists." });
    }
    return serverError(res, err);
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const {
      grade,
      section,
      adviserId = "",
      adviser = "",
      capacity,
    } = req.body || {};

    const current = await Section.findById(sectionId).lean();
    if (!current) return res.status(404).json({ ok: false, message: "Not found" });

    const nextGrade = String(grade || current.grade || "").trim();
    const nextSection = String(section || "").trim();
    const advId = String(adviserId || "").trim();
    let advName = String(adviser || "").trim();

    if (!nextSection) return badRequest(res, "Invalid request.");

    const gradeExists = await GradeLevel.findOne({ grade: nextGrade, isActive: true }).lean();
    if (!gradeExists) return badRequest(res, "Invalid request.");

    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) return badRequest(res, "Invalid request.");

    const duplicate = await Section.findOne({
      grade: nextGrade,
      sectionNorm: norm(nextSection),
      _id: { $ne: current._id },
      isActive: { $ne: false },
    }).lean();

    if (duplicate) {
      return res.status(409).json({ ok: false, message: "Section already exists." });
    }

    let teacher = null;
    let nextAdviserId = null;

    if (advId) {
      if (!mongoose.Types.ObjectId.isValid(advId)) {
        return badRequest(res, "Invalid request.");
      }

      teacher = await Teacher.findById(advId).lean();
      if (!teacher || teacher.isActive === false) {
        return badRequest(res, "Invalid request.");
      }

      const usedByOtherSection = await Section.findOne({
        adviserId: teacher._id,
        _id: { $ne: current._id },
        isActive: { $ne: false },
      }).lean();

      if (usedByOtherSection) {
        return res.status(409).json({
          ok: false,
          message: "Teacher is already assigned to another section.",
        });
      }

      advName =
        advName ||
        [teacher.firstName, teacher.middleName, teacher.lastName]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

      nextAdviserId = teacher._id;
    } else {
      advName = "";
      nextAdviserId = null;
    }

    const updated = await Section.findByIdAndUpdate(
      sectionId,
      {
        grade: nextGrade,
        section: nextSection,
        sectionNorm: norm(nextSection),
        adviserId: nextAdviserId,
        adviser: advName,
        adviserNorm: norm(advName),
        capacity: cap,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ ok: false, message: "Not found" });

    if (current.adviserId && String(current.adviserId) !== String(nextAdviserId || "")) {
      await Teacher.findByIdAndUpdate(current.adviserId, {
        $set: {
          className: "Unassigned",
          sectionName: "Unassigned",
        },
      });
    }

    if (nextAdviserId) {
      await Teacher.findByIdAndUpdate(nextAdviserId, {
        $set: {
          className: nextGrade,
          sectionName: nextSection,
        },
      });
    }

    return res.json({
      ok: true,
      data: {
        id: String(updated._id),
        grade: updated.grade,
        section: updated.section,
        adviserId: String(updated.adviserId || ""),
        adviser: updated.adviser || "",
        capacity: updated.capacity,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ ok: false, message: "Section already exists." });
    }
    return serverError(res, err);
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const gone = await Section.findByIdAndDelete(sectionId).lean();
    if (!gone) return res.status(404).json({ ok: false, message: "Not found" });

    if (gone.adviserId) {
      await Teacher.findByIdAndUpdate(gone.adviserId, {
        $set: {
          className: "Unassigned",
          sectionName: "Unassigned",
        },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
};