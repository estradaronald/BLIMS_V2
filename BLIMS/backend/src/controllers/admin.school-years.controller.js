const SchoolYear = require("../models/SchoolYear.model");

// helper
function makeDefaultQuarters() {
  return [
    { order: 1, name: "Quarter 1", start: null, end: null, locked: false },
    { order: 2, name: "Quarter 2", start: null, end: null, locked: false },
    { order: 3, name: "Quarter 3", start: null, end: null, locked: false },
    { order: 4, name: "Quarter 4", start: null, end: null, locked: false },
  ];
}

exports.getSchoolYears = async (req, res, next) => {
  try {
    const items = await SchoolYear.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      items,
    });
  } catch (error) {
    next(error);
  }
};

exports.createSchoolYear = async (req, res, next) => {
  try {
    const { name, start, end, autoCreateQuarters = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "School year name is required.",
      });
    }

    if (start && end && new Date(start) > new Date(end)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date.",
      });
    }

    const existing = await SchoolYear.findOne({
      name: name.trim(),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "That school year already exists.",
      });
    }

    const hasActive = await SchoolYear.findOne({ isActive: true });

    const newSchoolYear = await SchoolYear.create({
      name: name.trim(),
      start: start || null,
      end: end || null,
      isActive: !hasActive,
      quarters: autoCreateQuarters ? makeDefaultQuarters() : [],
    });

    res.status(201).json({
      success: true,
      message: "School year created successfully.",
      item: newSchoolYear,
    });
  } catch (error) {
    next(error);
  }
};

exports.setActiveSchoolYear = async (req, res, next) => {
  try {
    const { id } = req.params;

    const target = await SchoolYear.findById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "School year not found.",
      });
    }

    await SchoolYear.updateMany({}, { $set: { isActive: false } });
    target.isActive = true;
    await target.save();

    res.status(200).json({
      success: true,
      message: "School year set as active.",
      item: target,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateQuarters = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quarters } = req.body;

    if (!Array.isArray(quarters)) {
      return res.status(400).json({
        success: false,
        message: "Quarters must be an array.",
      });
    }

    for (const q of quarters) {
      if (q.start && q.end && new Date(q.start) > new Date(q.end)) {
        return res.status(400).json({
          success: false,
          message: `End date must be after start date for "${q.name}".`,
        });
      }
    }

    const schoolYear = await SchoolYear.findById(id);
    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message: "School year not found.",
      });
    }

    schoolYear.quarters = quarters.map((q, index) => ({
      order: index + 1,
      name: (q.name || `Quarter ${index + 1}`).trim(),
      start: q.start || null,
      end: q.end || null,
      locked: !!q.locked,
    }));

    await schoolYear.save();

    res.status(200).json({
      success: true,
      message: "Quarters updated successfully.",
      item: schoolYear,
    });
  } catch (error) {
    next(error);
  }
};

exports.getActiveSchoolYear = async (req, res, next) => {
  try {
    const item = await SchoolYear.findOne({ isActive: true });

    res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    next(error);
  }
};