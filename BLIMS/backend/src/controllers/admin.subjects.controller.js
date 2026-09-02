const GradeLevel = require("../models/GradeLevel.model");

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function hasDangerousKeys(obj) {
  if (!isPlainObject(obj)) return true;
  for (const k of Object.keys(obj)) {
    if (k.startsWith("$")) return true;
    if (k.includes(".")) return true;
    if (k === "__proto__" || k === "constructor" || k === "prototype") return true;
  }
  return false;
}

function safeString(v, { trim = true, min = 0, max = 120 } = {}) {
  if (v === undefined || v === null) return { ok: false };
  if (typeof v !== "string") return { ok: false };

  let s = v;
  if (trim) s = s.trim();

  if (s.length < min) return { ok: false };
  if (s.length > max) return { ok: false };

  return { ok: true, value: s };
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

exports.getSubjectsSummary = async (req, res) => {
  try {
    const grades = await GradeLevel.find({ isActive: true })
      .sort({ createdAt: 1, grade: 1 })
      .lean();

    const uniqueSubjects = new Set();

    const mappedGrades = grades.map((g) => {
      const subjects = Array.isArray(g.subjects) ? g.subjects : [];

      for (const subject of subjects) {
        if (typeof subject === "string" && subject.trim()) {
          uniqueSubjects.add(subject.trim());
        }
      }

      return {
        id: String(g._id),
        grade: g.grade,
        subjects,
      };
    });

    const data = {
      grades: mappedGrades,
      masterSubjects: Array.from(uniqueSubjects).sort((a, b) =>
        a.localeCompare(b)
      ),
    };

    res.json({ ok: true, data });
  } catch (err) {
    console.error("getSubjectsSummary error:", err);
    res.status(500).json({ ok: false, message: "Failed to load subjects." });
  }
};

exports.getSubjectsByGrade = async (req, res) => {
  try {
    const gradeRaw = safeString(String(req.query.grade || ""), {
      trim: true,
      min: 1,
      max: 80,
    });

    if (!gradeRaw.ok) return badRequest(res, "Grade is required.");

    const gradeDoc = await GradeLevel.findOne({
      grade: gradeRaw.value,
      isActive: true,
    }).lean();

    if (!gradeDoc) {
      return res.status(404).json({ ok: false, message: "Grade not found." });
    }

    res.json({
      ok: true,
      data: {
        grade: gradeDoc.grade,
        subjects: Array.isArray(gradeDoc.subjects) ? gradeDoc.subjects : [],
      },
    });
  } catch (err) {
    console.error("getSubjectsByGrade error:", err);
    res.status(500).json({ ok: false, message: "Failed to load grade subjects." });
  }
};

exports.createSubject = async (req, res) => {
  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const grade = safeString(req.body.grade, {
      trim: true,
      min: 1,
      max: 80,
    });

    const name = safeString(req.body.name, {
      trim: true,
      min: 1,
      max: 120,
    });

    if (!grade.ok) return badRequest(res, "Grade is required.");
    if (!name.ok) return badRequest(res, "Subject name is required.");

    const gradeDoc = await GradeLevel.findOne({
      grade: grade.value,
      isActive: true,
    });

    if (!gradeDoc) {
      return res.status(404).json({ ok: false, message: "Grade not found." });
    }

    const currentSubjects = Array.isArray(gradeDoc.subjects) ? gradeDoc.subjects : [];
    const exists = currentSubjects.some((s) => norm(s) === norm(name.value));

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Subject already exists in this grade level.",
      });
    }

    gradeDoc.subjects = [...currentSubjects, name.value];
    await gradeDoc.save();

    res.status(201).json({
      ok: true,
      data: {
        grade: gradeDoc.grade,
        subjects: gradeDoc.subjects,
        addedSubject: name.value,
      },
    });
  } catch (err) {
    console.error("createSubject error:", err);
    res.status(500).json({ ok: false, message: "Failed to create subject." });
  }
};

exports.assignSubjectsToGrade = async (req, res) => {
  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const grade = safeString(req.body.grade, {
      trim: true,
      min: 1,
      max: 80,
    });

    if (!grade.ok) return badRequest(res, "Grade is required.");
    if (!Array.isArray(req.body.subjects)) {
      return badRequest(res, "Subjects must be an array.");
    }

    const subjectNames = [];
    const seen = new Set();

    for (const item of req.body.subjects) {
      const s = safeString(item, { trim: true, min: 1, max: 120 });
      if (!s.ok) return badRequest(res, "Invalid subject value.");

      const key = norm(s.value);
      if (!seen.has(key)) {
        seen.add(key);
        subjectNames.push(s.value);
      }
    }

    const gradeDoc = await GradeLevel.findOne({
      grade: grade.value,
      isActive: true,
    });

    if (!gradeDoc) {
      return res.status(404).json({ ok: false, message: "Grade not found." });
    }

    gradeDoc.subjects = subjectNames;
    await gradeDoc.save();

    res.json({
      ok: true,
      data: {
        grade: gradeDoc.grade,
        subjects: gradeDoc.subjects,
      },
    });
  } catch (err) {
    console.error("assignSubjectsToGrade error:", err);
    res.status(500).json({ ok: false, message: "Failed to assign subjects." });
  }
};

exports.removeSubjectFromGrade = async (req, res) => {
  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const grade = safeString(req.body.grade, {
      trim: true,
      min: 1,
      max: 80,
    });

    const subject = safeString(req.body.subject, {
      trim: true,
      min: 1,
      max: 120,
    });

    if (!grade.ok || !subject.ok) {
      return badRequest(res, "Grade and subject are required.");
    }

    const gradeDoc = await GradeLevel.findOne({
      grade: grade.value,
      isActive: true,
    });

    if (!gradeDoc) {
      return res.status(404).json({ ok: false, message: "Grade not found." });
    }

    gradeDoc.subjects = (gradeDoc.subjects || []).filter(
      (s) => norm(s) !== norm(subject.value)
    );

    await gradeDoc.save();

    res.json({
      ok: true,
      data: {
        grade: gradeDoc.grade,
        subjects: gradeDoc.subjects,
      },
    });
  } catch (err) {
    console.error("removeSubjectFromGrade error:", err);
    res.status(500).json({ ok: false, message: "Failed to remove subject." });
  }
};