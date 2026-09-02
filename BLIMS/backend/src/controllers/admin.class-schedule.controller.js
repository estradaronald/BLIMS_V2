const ClassSchedule = require("../models/ClassSchedule");
const Section = require("../models/Section");

function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseTimeToMin(t) {
  if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
  return hh * 60 + mm;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

function serverError(res, err) {
  console.error("❌ Class schedule controller error:", err);
  return res.status(500).json({ ok: false, message: "Server error" });
}

async function getSectionAdviser(grade, section) {
  const row = await Section.findOne({
    grade,
    section,
    isActive: true,
  }).lean();

  return row?.adviser || "";
}

exports.getSchedules = async (req, res) => {
  try {
    const { grade, section, day } = req.query;

    const filter = { isActive: true };
    if (grade) filter.grade = grade;
    if (section) filter.section = section;
    if (day) filter.day = day;

    const rows = await ClassSchedule.find(filter).sort({ day: 1, start: 1, subject: 1 }).lean();

    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: String(r._id),
        grade: r.grade,
        section: r.section,
        subject: r.subject,
        day: r.day,
        start: r.start,
        end: r.end,
        room: r.room || "",
        teacher: r.teacher || "",
        notes: r.notes || "",
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.createDaySchedule = async (req, res) => {
  try {
    const { grade, section, day, notes, entries } = req.body || {};

    if (!grade) return badRequest(res, "Grade is required.");
    if (!section) return badRequest(res, "Section is required.");
    if (!day) return badRequest(res, "Day is required.");
    if (!Array.isArray(entries) || !entries.length) {
      return badRequest(res, "At least one schedule entry is required.");
    }

    const teacher = await getSectionAdviser(grade, section);

    for (const entry of entries) {
      if (!entry?.subject) return badRequest(res, "Subject is required.");
      if (!entry?.start) return badRequest(res, `Start time is required for ${entry.subject || "a subject"}.`);
      if (!entry?.end) return badRequest(res, `End time is required for ${entry.subject || "a subject"}.`);

      const startMin = parseTimeToMin(entry.start);
      const endMin = parseTimeToMin(entry.end);

      if (!Number.isFinite(startMin)) {
        return badRequest(res, `Invalid start time for ${entry.subject}.`);
      }
      if (!Number.isFinite(endMin)) {
        return badRequest(res, `Invalid end time for ${entry.subject}.`);
      }
      if (endMin <= startMin) {
        return badRequest(res, `End time must be after start time for ${entry.subject}.`);
      }
    }

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];

        const aStart = parseTimeToMin(a.start);
        const aEnd = parseTimeToMin(a.end);
        const bStart = parseTimeToMin(b.start);
        const bEnd = parseTimeToMin(b.end);

        if (overlaps(aStart, aEnd, bStart, bEnd)) {
          return badRequest(
            res,
            `Time already taken: "${a.subject}" (${a.start}-${a.end}) overlaps "${b.subject}" (${b.start}-${b.end}).`
          );
        }
      }
    }

    const existing = await ClassSchedule.find({
      grade,
      section,
      day,
      isActive: true,
    }).lean();

    for (const entry of entries) {
      const startMin = parseTimeToMin(entry.start);
      const endMin = parseTimeToMin(entry.end);

      for (const row of existing) {
        const rowStart = parseTimeToMin(row.start);
        const rowEnd = parseTimeToMin(row.end);

        if (overlaps(startMin, endMin, rowStart, rowEnd)) {
          return badRequest(
            res,
            `Time already taken: "${entry.subject}" overlaps "${row.subject}" (${row.start}-${row.end}).`
          );
        }
      }
    }

    const docs = entries.map((entry) => ({
      grade,
      section,
      subject: entry.subject,
      day,
      start: entry.start,
      end: entry.end,
      room: entry.room || "",
      teacher: teacher || "",
      notes: notes || "",
      isActive: true,
    }));

    const created = await ClassSchedule.insertMany(docs);

    return res.status(201).json({
      ok: true,
      message: "Day schedule created successfully.",
      data: created.map((r) => ({
        id: String(r._id),
        grade: r.grade,
        section: r.section,
        subject: r.subject,
        day: r.day,
        start: r.start,
        end: r.end,
        room: r.room || "",
        teacher: r.teacher || "",
        notes: r.notes || "",
      })),
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.updateDaySchedule = async (req, res) => {
  try {
    const { grade, section, day } = req.params;
    const { notes, entries } = req.body || {};

    if (!grade) return badRequest(res, "Grade is required.");
    if (!section) return badRequest(res, "Section is required.");
    if (!day) return badRequest(res, "Day is required.");
    if (!Array.isArray(entries) || !entries.length) {
      return badRequest(res, "At least one schedule entry is required.");
    }

    const teacher = await getSectionAdviser(grade, section);

    for (const entry of entries) {
      if (!entry?.subject) return badRequest(res, "Subject is required.");
      if (!entry?.start) return badRequest(res, `Start time is required for ${entry.subject || "a subject"}.`);
      if (!entry?.end) return badRequest(res, `End time is required for ${entry.subject || "a subject"}.`);

      const startMin = parseTimeToMin(entry.start);
      const endMin = parseTimeToMin(entry.end);

      if (!Number.isFinite(startMin)) {
        return badRequest(res, `Invalid start time for ${entry.subject}.`);
      }
      if (!Number.isFinite(endMin)) {
        return badRequest(res, `Invalid end time for ${entry.subject}.`);
      }
      if (endMin <= startMin) {
        return badRequest(res, `End time must be after start time for ${entry.subject}.`);
      }
    }

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];

        const aStart = parseTimeToMin(a.start);
        const aEnd = parseTimeToMin(a.end);
        const bStart = parseTimeToMin(b.start);
        const bEnd = parseTimeToMin(b.end);

        if (overlaps(aStart, aEnd, bStart, bEnd)) {
          return badRequest(
            res,
            `Time already taken: "${a.subject}" (${a.start}-${a.end}) overlaps "${b.subject}" (${b.start}-${b.end}).`
          );
        }
      }
    }

    const existingOther = await ClassSchedule.find({
      grade,
      section,
      day: { $ne: day },
      isActive: true,
    }).lean();

    for (const entry of entries) {
      const startMin = parseTimeToMin(entry.start);
      const endMin = parseTimeToMin(entry.end);

      for (const row of existingOther) {
        if (row.day !== day) continue;
        const rowStart = parseTimeToMin(row.start);
        const rowEnd = parseTimeToMin(row.end);

        if (overlaps(startMin, endMin, rowStart, rowEnd)) {
          return badRequest(
            res,
            `Time already taken: "${entry.subject}" overlaps "${row.subject}" (${row.start}-${row.end}).`
          );
        }
      }
    }

    await ClassSchedule.deleteMany({
      grade,
      section,
      day,
    });

    const docs = entries.map((entry) => ({
      grade,
      section,
      subject: entry.subject,
      day,
      start: entry.start,
      end: entry.end,
      room: entry.room || "",
      teacher: teacher || "",
      notes: notes || "",
      isActive: true,
    }));

    const created = await ClassSchedule.insertMany(docs);

    return res.json({
      ok: true,
      message: "Day schedule updated successfully.",
      data: created.map((r) => ({
        id: String(r._id),
        grade: r.grade,
        section: r.section,
        subject: r.subject,
        day: r.day,
        start: r.start,
        end: r.end,
        room: r.room || "",
        teacher: r.teacher || "",
        notes: r.notes || "",
      })),
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.deleteScheduleEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return badRequest(res, "Schedule ID is required.");

    const deleted = await ClassSchedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, message: "Schedule entry not found." });
    }

    return res.json({
      ok: true,
      message: "Schedule entry deleted successfully.",
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.deleteDaySchedule = async (req, res) => {
  try {
    const { grade, section, day } = req.params;

    if (!grade) return badRequest(res, "Grade is required.");
    if (!section) return badRequest(res, "Section is required.");
    if (!day) return badRequest(res, "Day is required.");

    await ClassSchedule.deleteMany({ grade, section, day });

    return res.json({
      ok: true,
      message: "Day schedule deleted successfully.",
    });
  } catch (err) {
    return serverError(res, err);
  }
};