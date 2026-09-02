// backend/controllers/event.controller.js
const Event = require("../models/Event");

exports.getEvents = async (req, res) => {
  try {
    const rows = await Event.find().sort({ start: 1, createdAt: -1 }).lean();
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("getEvents error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      type = "school",
      audience = "all",
      start,
      end,
      location = "",
      description = "",
      image = null,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ ok: false, message: "Event title is required." });
    }

    if (!start) {
      return res.status(400).json({ ok: false, message: "Start date/time is required." });
    }

    const created = await Event.create({
      title: title.trim(),
      type,
      audience,
      start,
      end: end || null,
      location: String(location || "").trim(),
      description: String(description || "").trim(),
      image: image || null,
    });

    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    console.error("createEvent error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      type,
      audience,
      start,
      end,
      location,
      description,
      image,
    } = req.body;

    const row = await Event.findById(id);
    if (!row) {
      return res.status(404).json({ ok: false, message: "Event not found." });
    }

    if (title !== undefined) row.title = String(title).trim();
    if (type !== undefined) row.type = type;
    if (audience !== undefined) row.audience = audience;
    if (start !== undefined) row.start = start;
    if (end !== undefined) row.end = end || null;
    if (location !== undefined) row.location = String(location || "").trim();
    if (description !== undefined) row.description = String(description || "").trim();
    if (image !== undefined) row.image = image || null;

    await row.save();

    return res.json({ ok: true, data: row });
  } catch (err) {
    console.error("updateEvent error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await Event.findById(id);
    if (!row) {
      return res.status(404).json({ ok: false, message: "Event not found." });
    }

    await Event.findByIdAndDelete(id);

    return res.json({ ok: true, message: "Event deleted successfully." });
  } catch (err) {
    console.error("deleteEvent error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};