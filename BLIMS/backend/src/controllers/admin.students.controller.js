const argon2 = require("argon2");
const Student = require("../models/Student.model");
const User = require("../models/User.model");
const Counter = require("../models/Counter.model");
const Enrollment = require("../models/Enrollment.model");
const SchoolYear = require("../models/SchoolYear.model");

// -----------------------------
// Validation helpers
// -----------------------------
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function hasDangerousKeys(obj) {
  if (!isPlainObject(obj)) return true;

  for (const k of Object.keys(obj)) {
    if (k.startsWith("$")) return true;
    if (k.includes(".")) return true;
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      return true;
    }
  }

  return false;
}

function safeString(v, { trim = true, min = 0, max = 200 } = {}) {
  if (v === undefined || v === null) {
    return { ok: false };
  }

  if (typeof v !== "string") {
    return { ok: false };
  }

  let s = v;

  if (trim) {
    s = s.trim();
  }

  if (s.length < min) {
    return { ok: false };
  }

  if (s.length > max) {
    return { ok: false };
  }

  return {
    ok: true,
    value: s,
  };
}

function safeOptionalString(v, opts) {
  if (v === undefined || v === null) {
    return {
      ok: true,
      value: undefined,
    };
  }

  return safeString(v, opts);
}

function safeEmail(v) {
  const s = safeOptionalString(v, {
    trim: true,
    min: 0,
    max: 254,
  });

  if (!s.ok) {
    return { ok: false };
  }

  if (s.value === undefined || s.value === "") {
    return {
      ok: true,
      value: "",
    };
  }

  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.value);

  if (!ok) {
    return { ok: false };
  }

  return {
    ok: true,
    value: s.value.toLowerCase(),
  };
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({
    ok: false,
    message,
  });
}

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizePHMobile(input) {
  const d = digitsOnly(input);

  if (!d) return "";

  if (d.length === 11 && d.startsWith("09")) {
    return "+63" + d.slice(1);
  }

  if (d.length === 10 && d.startsWith("9")) {
    return "+63" + d;
  }

  if (d.length === 12 && d.startsWith("63")) {
    return "+63" + d.slice(2);
  }

  if (d.length === 13 && d.startsWith("063")) {
    return "+63" + d.slice(3);
  }

  if (d.length > 10) {
    const last10 = d.slice(-10);

    if (last10.startsWith("9")) {
      return "+63" + last10;
    }
  }

  return "";
}

// -----------------------------
// Generate Student ID
// -----------------------------
async function nextStudentId() {
  const counter = await Counter.findOneAndUpdate(
    { key: "studentId" },
    { $inc: { seq: 1 } },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  const n = counter?.seq || 1;

  return `STD-${String(n).padStart(4, "0")}`;
}

// -----------------------------
// Generate temporary password
// -----------------------------
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";

  let out = "";

  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }

  return out;
}

// -----------------------------
// Serialize student
// -----------------------------
function serializeStudent(studentDoc) {
  return {
    id: String(studentDoc._id),

    studentId: studentDoc.studentId,

    firstName: studentDoc.firstName || "",

    middleName: studentDoc.middleName || "",

    lastName: studentDoc.lastName || "",

    gender: studentDoc.gender || "male",

    dob: studentDoc.dob || "",

    lrn: studentDoc.lrn || "",

    className: studentDoc.className || "",

    sectionName: studentDoc.sectionName || "",

    phone: studentDoc.phone || "",

    email: studentDoc.email || "",

    address: studentDoc.address || {
      street: "",
      provinceCode: "",
      cityCode: "",
      brgyCode: "",
      postal: "",
    },

    parents: studentDoc.parents || {
      fatherName: "",
      fatherOccupation: "",
      fatherContact: "",
      motherName: "",
      motherOccupation: "",
      motherContact: "",
    },

    photoDataUrl: studentDoc.photoDataUrl || "",

    isActive: !!studentDoc.isActive,

    createdAt: studentDoc.createdAt,

    updatedAt: studentDoc.updatedAt,
  };
}

// ============================================================
// LIST STUDENTS
// ============================================================

exports.listStudents = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    const classFilter = String(req.query.class || "all").trim();

    const filter = {};

    if (classFilter && classFilter !== "all") {
      filter.className = classFilter;
    }

    let students = await Student.find(filter).sort({ createdAt: -1 }).lean();

    if (q) {
      const needle = q.toLowerCase();

      students = students.filter((s) => {
        const fullName = [s.firstName, s.middleName, s.lastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          fullName.includes(needle) ||
          String(s.studentId || "")
            .toLowerCase()
            .includes(needle) ||
          String(s.lrn || "")
            .toLowerCase()
            .includes(needle)
        );
      });
    }

    res.json({
      ok: true,

      students: students.map(serializeStudent),
    });
  } catch (err) {
    console.error("listStudents error:", err);

    res.status(500).json({
      ok: false,
      message: "Failed to load students.",
    });
  }
};

// ============================================================
// CREATE SINGLE STUDENT
// ============================================================

exports.createStudent = async (req, res) => {
  let createdUserId = null;
  let createdStudentId = null;

  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const body = req.body;

    const firstName = safeString(body.firstName ?? "", {
      trim: true,
      min: 1,
      max: 80,
    });

    const middleName = safeString(body.middleName ?? "", {
      trim: true,
      min: 0,
      max: 80,
    });

    const lastName = safeString(body.lastName ?? "", {
      trim: true,
      min: 1,
      max: 80,
    });

    const genderRaw = safeOptionalString(body.gender ?? "male", {
      trim: true,
      min: 1,
      max: 10,
    });

    const dob = safeOptionalString(body.dob ?? "", {
      trim: true,
      min: 0,
      max: 40,
    });

    const lrn = safeString(body.lrn ?? "", {
      trim: true,
      min: 12,
      max: 12,
    });

    const className = safeOptionalString(body.className ?? "", {
      trim: true,
      min: 0,
      max: 60,
    });

    const sectionName = safeOptionalString(body.sectionName ?? "", {
      trim: true,
      min: 0,
      max: 60,
    });

    const email = safeEmail(body.email ?? "");

    const phoneRaw = safeOptionalString(body.phone ?? "", {
      trim: true,
      min: 0,
      max: 40,
    });

    const street = safeOptionalString(body.street ?? "", {
      trim: true,
      min: 0,
      max: 150,
    });

    const provinceCode = safeOptionalString(body.provinceCode ?? "", {
      trim: true,
      min: 0,
      max: 20,
    });

    const cityCode = safeOptionalString(body.cityCode ?? "", {
      trim: true,
      min: 0,
      max: 20,
    });

    const brgyCode = safeOptionalString(body.brgyCode ?? "", {
      trim: true,
      min: 0,
      max: 20,
    });

    const postal = safeOptionalString(body.postal ?? "", {
      trim: true,
      min: 0,
      max: 12,
    });

    const fatherName = safeOptionalString(body.fatherName ?? "", {
      trim: true,
      min: 0,
      max: 80,
    });

    const fatherOccupation = safeOptionalString(body.fatherOccupation ?? "", {
      trim: true,
      min: 0,
      max: 80,
    });

    const fatherContactRaw = safeOptionalString(body.fatherContact ?? "", {
      trim: true,
      min: 0,
      max: 40,
    });

    const motherName = safeOptionalString(body.motherName ?? "", {
      trim: true,
      min: 0,
      max: 80,
    });

    const motherOccupation = safeOptionalString(body.motherOccupation ?? "", {
      trim: true,
      min: 0,
      max: 80,
    });

    const motherContactRaw = safeOptionalString(body.motherContact ?? "", {
      trim: true,
      min: 0,
      max: 40,
    });

    const photoDataUrl = safeOptionalString(body.photoDataUrl ?? "", {
      trim: false,
      min: 0,
      max: 20000,
    });

    if (
      !firstName.ok ||
      !middleName.ok ||
      !lastName.ok ||
      !genderRaw.ok ||
      !dob.ok ||
      !lrn.ok ||
      !className.ok ||
      !sectionName.ok ||
      !email.ok ||
      !phoneRaw.ok ||
      !street.ok ||
      !provinceCode.ok ||
      !cityCode.ok ||
      !brgyCode.ok ||
      !postal.ok ||
      !fatherName.ok ||
      !fatherOccupation.ok ||
      !fatherContactRaw.ok ||
      !motherName.ok ||
      !motherOccupation.ok ||
      !motherContactRaw.ok ||
      !photoDataUrl.ok
    ) {
      return badRequest(res);
    }

    const gender = String(genderRaw.value || "male").toLowerCase();

    if (!["male", "female"].includes(gender)) {
      return badRequest(res, "Invalid gender.");
    }

    if (!/^\d{12}$/.test(lrn.value)) {
      return badRequest(res, "LRN must be exactly 12 digits.");
    }

    const phone = normalizePHMobile(phoneRaw.value || "");

    const fatherContact = normalizePHMobile(fatherContactRaw.value || "");

    const motherContact = normalizePHMobile(motherContactRaw.value || "");

    if ((phoneRaw.value || "") && !phone) {
      return badRequest(res, "Invalid student phone number.");
    }

    if ((fatherContactRaw.value || "") && !fatherContact) {
      return badRequest(res, "Invalid father contact number.");
    }

    if ((motherContactRaw.value || "") && !motherContact) {
      return badRequest(res, "Invalid mother contact number.");
    }

    const existingLrn = await Student.findOne({
      lrn: lrn.value,
    }).lean();

    if (existingLrn) {
      return res.status(409).json({
        ok: false,
        message: "LRN already exists.",
      });
    }

    if (email.value) {
      const existingEmail = await Student.findOne({
        email: email.value,
      }).lean();

      if (existingEmail) {
        return res.status(409).json({
          ok: false,
          message: "Email already exists.",
        });
      }
    }

    // Generate ID only after validation
    const studentId = await nextStudentId();

    const tempPass = generateTempPassword();

    const passwordHash = await argon2.hash(tempPass);

    const username = studentId;

    const existingUser = await User.findOne({
      username,
    }).lean();

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        message: "Username already exists.",
      });
    }

    const user = await User.create({
      username,
      role: "student",
      password_hash: passwordHash,
      must_change_password: true,
      status: "active",
    });

    createdUserId = user._id;

    const student = await Student.create({
      userId: user._id,
      studentId,

      firstName: firstName.value,

      middleName: middleName.value,

      lastName: lastName.value,

      gender,
      dob: dob.value || "",

      lrn: lrn.value,

      className: className.value || "Unassigned",

      sectionName: sectionName.value || "Unassigned",

      phone,

      email: email.value || "",

      address: {
        street: street.value || "",

        provinceCode: provinceCode.value || "",

        cityCode: cityCode.value || "",

        brgyCode: brgyCode.value || "",

        postal: postal.value || "",
      },

      parents: {
        fatherName: fatherName.value || "",

        fatherOccupation: fatherOccupation.value || "",

        fatherContact: fatherContact || "",

        motherName: motherName.value || "",

        motherOccupation: motherOccupation.value || "",

        motherContact: motherContact || "",
      },

      photoDataUrl: photoDataUrl.value || "",

      isActive: true,
    });

    createdStudentId = student._id;

    // Record enrollment under the active school year
    const activeSchoolYear = await SchoolYear.findOne({
      isActive: true,
    }).lean();

    if (!activeSchoolYear) {
      throw new Error("No active school year is configured.");
    }

    await Enrollment.create({
      studentId: student._id,
      schoolYearId: activeSchoolYear._id,
      schoolYearName: activeSchoolYear.name,
      className: student.className || "Unassigned",
      sectionName: student.sectionName || "Unassigned",
    });

    res.status(201).json({
      ok: true,

      student: serializeStudent(student),

      tempPass,
    });
  } catch (err) {
    console.error("createStudent error:", err);

    if (createdStudentId) {
      try {
        await Enrollment.deleteMany({
          studentId: createdStudentId,
        });

        await Student.deleteOne({
          _id: createdStudentId,
        });
      } catch (cleanupErr) {
        console.error("createStudent cleanup error:", cleanupErr);
      }
    }

    if (createdUserId) {
      try {
        await User.deleteOne({
          _id: createdUserId,
        });
      } catch (cleanupErr) {
        console.error("createStudent user cleanup error:", cleanupErr);
      }
    }

    res.status(500).json({
      ok: false,
      message: "Failed to create student.",
    });
  }
};

// ============================================================
// BULK CREATE STUDENTS
// ============================================================

exports.bulkCreateStudents = async (req, res) => {
  const createdUserIds = [];
  const createdStudentIds = [];

  let activeSchoolYear = null;

  try {
    activeSchoolYear = await SchoolYear.findOne({
      isActive: true,
    }).lean();

    if (!activeSchoolYear) {
      throw new Error("No active school year is configured.");
    }
    // -----------------------------
    // Validate request
    // -----------------------------

    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const learners = req.body.learners;

    if (!Array.isArray(learners)) {
      return badRequest(res, "Learners must be an array.");
    }

    if (learners.length === 0) {
      return badRequest(res, "No learners provided.");
    }

    // Prevent extremely large requests
    if (learners.length > 50) {
      return badRequest(res, "Maximum of 50 learners per batch.");
    }

    // -----------------------------
    // Prepare learners
    // -----------------------------

    const prepared = [];

    const batchLrns = new Set();

    for (let i = 0; i < learners.length; i++) {
      const body = learners[i];

      const rowNumber = i + 1;

      if (!isPlainObject(body) || hasDangerousKeys(body)) {
        return badRequest(res, `Invalid data on learner ${rowNumber}.`);
      }

      // -----------------------------
      // First name
      // -----------------------------

      const firstName = safeString(body.firstName ?? "", {
        trim: true,
        min: 1,
        max: 80,
      });

      if (!firstName.ok) {
        return badRequest(res, `Invalid first name on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Middle name
      // -----------------------------

      const middleName = safeString(body.middleName ?? "", {
        trim: true,
        min: 0,
        max: 80,
      });

      if (!middleName.ok) {
        return badRequest(res, `Invalid middle name on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Last name
      // -----------------------------

      const lastName = safeString(body.lastName ?? "", {
        trim: true,
        min: 1,
        max: 80,
      });

      if (!lastName.ok) {
        return badRequest(res, `Invalid last name on learner ${rowNumber}.`);
      }

      // -----------------------------
      // LRN
      // -----------------------------

      const lrn = safeString(body.lrn ?? "", {
        trim: true,
        min: 12,
        max: 12,
      });

      if (!lrn.ok) {
        return badRequest(res, `Invalid LRN on learner ${rowNumber}.`);
      }

      if (!/^\d{12}$/.test(lrn.value)) {
        return badRequest(
          res,
          `LRN on learner ${rowNumber} must be exactly 12 digits.`,
        );
      }

      // -----------------------------
      // Duplicate LRN in batch
      // -----------------------------

      if (batchLrns.has(lrn.value)) {
        return res.status(409).json({
          ok: false,
          message: `Duplicate LRN in batch: ${lrn.value}`,
        });
      }

      batchLrns.add(lrn.value);

      // -----------------------------
      // Phone
      // -----------------------------

      const phoneRaw = safeOptionalString(body.phone ?? "", {
        trim: true,
        min: 0,
        max: 40,
      });

      if (!phoneRaw.ok) {
        return badRequest(res, `Invalid phone number on learner ${rowNumber}.`);
      }

      const phone = normalizePHMobile(phoneRaw.value || "");

      if (phoneRaw.value && !phone) {
        return badRequest(res, `Invalid phone number on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Grade Level
      // -----------------------------

      const className = safeOptionalString(
        body.className ?? body.gradeLevel ?? "",
        {
          trim: true,
          min: 0,
          max: 60,
        },
      );

      if (!className.ok) {
        return badRequest(res, `Invalid grade level on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Section
      // -----------------------------

      const sectionName = safeOptionalString(
        body.sectionName ?? body.section ?? "",
        {
          trim: true,
          min: 0,
          max: 60,
        },
      );

      if (!sectionName.ok) {
        return badRequest(res, `Invalid section on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Gender
      // -----------------------------

      const genderRaw = safeOptionalString(body.gender ?? "male", {
        trim: true,
        min: 1,
        max: 10,
      });

      if (!genderRaw.ok) {
        return badRequest(res, `Invalid gender on learner ${rowNumber}.`);
      }

      const gender = String(genderRaw.value || "male").toLowerCase();

      if (!["male", "female"].includes(gender)) {
        return badRequest(res, `Invalid gender on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Date of birth
      // -----------------------------

      const dob = safeOptionalString(body.dob ?? "", {
        trim: true,
        min: 0,
        max: 40,
      });

      if (!dob.ok) {
        return badRequest(
          res,
          `Invalid date of birth on learner ${rowNumber}.`,
        );
      }

      // -----------------------------
      // Email
      // -----------------------------

      const email = safeEmail(body.email ?? "");

      if (!email.ok) {
        return badRequest(res, `Invalid email on learner ${rowNumber}.`);
      }

      // -----------------------------
      // Prepare learner
      // -----------------------------

      prepared.push({
        firstName: firstName.value,

        middleName: middleName.value,

        lastName: lastName.value,

        gender,

        dob: dob.value || "",

        lrn: lrn.value,

        className: className.value || "Unassigned",

        sectionName: sectionName.value || "Unassigned",

        phone,

        email: email.value || "",
      });
    }

    // ========================================================
    // CHECK EXISTING LRNs
    // ========================================================

    const existingStudents = await Student.find({
      lrn: {
        $in: Array.from(batchLrns),
      },
    })
      .select("lrn")
      .lean();

    if (existingStudents.length > 0) {
      return res.status(409).json({
        ok: false,
        message: `LRN already exists: ${existingStudents[0].lrn}`,
      });
    }

    // ========================================================
    // CHECK EXISTING EMAILS
    // ========================================================

    const batchEmails = prepared
      .map((student) => student.email)
      .filter(Boolean);

    if (batchEmails.length > 0) {
      const existingEmails = await Student.find({
        email: {
          $in: batchEmails,
        },
      })
        .select("email")
        .lean();

      if (existingEmails.length > 0) {
        return res.status(409).json({
          ok: false,
          message: `Email already exists: ${existingEmails[0].email}`,
        });
      }
    }

    // ========================================================
    // CREATE USERS + STUDENTS
    // ========================================================

    const results = [];

    for (const learner of prepared) {
      // -----------------------------
      // Generate student ID
      // -----------------------------

      const studentId = await nextStudentId();

      // -----------------------------
      // Generate temporary password
      // -----------------------------

      const tempPass = generateTempPassword();

      // -----------------------------
      // Hash password
      // -----------------------------

      const passwordHash = await argon2.hash(tempPass);

      // -----------------------------
      // Username
      // -----------------------------

      const username = studentId;

      // -----------------------------
      // Check username
      // -----------------------------

      const existingUser = await User.findOne({
        username,
      }).lean();

      if (existingUser) {
        throw new Error(`Username already exists: ${username}`);
      }

      // -----------------------------
      // Create User
      // -----------------------------

      const user = await User.create({
        username,

        role: "student",

        password_hash: passwordHash,

        must_change_password: true,

        status: "active",
      });

      createdUserIds.push(user._id);

      // -----------------------------
      // Create Student
      // -----------------------------

      const student = await Student.create({
        userId: user._id,

        studentId,

        firstName: learner.firstName,

        middleName: learner.middleName,

        lastName: learner.lastName,

        gender: learner.gender,

        dob: learner.dob,

        lrn: learner.lrn,

        className: learner.className,

        sectionName: learner.sectionName,

        phone: learner.phone,

        email: learner.email,

        address: {
          street: "",
          provinceCode: "",
          cityCode: "",
          brgyCode: "",
          postal: "",
        },

        parents: {
          fatherName: "",
          fatherOccupation: "",
          fatherContact: "",

          motherName: "",
          motherOccupation: "",
          motherContact: "",
        },

        photoDataUrl: "",

        isActive: true,
      });

      createdStudentIds.push(student._id);

      // Record enrollment under the active school year
      await Enrollment.create({
        studentId: student._id,
        schoolYearId: activeSchoolYear._id,
        schoolYearName: activeSchoolYear.name,
        className: student.className || "Unassigned",
        sectionName: student.sectionName || "Unassigned",
      });

      // -----------------------------
      // Store result
      // -----------------------------

      results.push({
        student: serializeStudent(student),
        username,
        tempPass,
      });
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    return res.status(201).json({
      ok: true,

      message: `${results.length} learners created successfully.`,

      learners: results,
    });
  } catch (err) {
    console.error("bulkCreateStudents error:", err);

    // ========================================================
    // CLEANUP
    // ========================================================

    try {
      if (createdStudentIds.length > 0) {
        await Enrollment.deleteMany({
          studentId: {
            $in: createdStudentIds,
          },
        });

        await Student.deleteMany({
          _id: {
            $in: createdStudentIds,
          },
        });
      }

      if (createdUserIds.length > 0) {
        await User.deleteMany({
          _id: {
            $in: createdUserIds,
          },
        });
      }
    } catch (cleanupErr) {
      console.error("bulkCreateStudents cleanup error:", cleanupErr);
    }

    return res.status(500).json({
      ok: false,
      message: "Failed to create learners.",
    });
  }
};

// ============================================================
// UPDATE STUDENT
// ============================================================

exports.updateStudent = async (req, res) => {
  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const { studentId } = req.params;

    const body = req.body;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student not found.",
      });
    }

    const setIfProvided = (key, opts) => {
      if (body[key] === undefined || body[key] === null) {
        return {
          ok: true,
          value: undefined,
        };
      }

      if (isPlainObject(body[key]) || Array.isArray(body[key])) {
        return {
          ok: false,
        };
      }

      return safeString(String(body[key]), opts);
    };

    const firstName = setIfProvided("firstName", {
      trim: true,
      min: 1,
      max: 80,
    });

    const middleName = setIfProvided("middleName", {
      trim: true,
      min: 0,
      max: 80,
    });

    const lastName = setIfProvided("lastName", {
      trim: true,
      min: 1,
      max: 80,
    });

    const dob = setIfProvided("dob", {
      trim: true,
      min: 0,
      max: 40,
    });

    const lrn = setIfProvided("lrn", {
      trim: true,
      min: 12,
      max: 12,
    });

    const className = setIfProvided("className", {
      trim: true,
      min: 0,
      max: 60,
    });

    const sectionName = setIfProvided("sectionName", {
      trim: true,
      min: 0,
      max: 60,
    });

    if (
      !firstName.ok ||
      !middleName.ok ||
      !lastName.ok ||
      !dob.ok ||
      !lrn.ok ||
      !className.ok ||
      !sectionName.ok
    ) {
      return badRequest(res);
    }

    if (body.gender !== undefined) {
      const g = String(body.gender || "")
        .trim()
        .toLowerCase();

      if (!["male", "female"].includes(g)) {
        return badRequest(res, "Invalid gender.");
      }

      student.gender = g;
    }

    if (firstName.value !== undefined) {
      student.firstName = firstName.value;
    }

    if (middleName.value !== undefined) {
      student.middleName = middleName.value;
    }

    if (lastName.value !== undefined) {
      student.lastName = lastName.value;
    }

    if (dob.value !== undefined) {
      student.dob = dob.value;
    }

    if (className.value !== undefined) {
      student.className = className.value || "Unassigned";
    }

    if (sectionName.value !== undefined) {
      student.sectionName = sectionName.value || "Unassigned";
    }

    if (lrn.value !== undefined) {
      if (!/^\d{12}$/.test(lrn.value)) {
        return badRequest(res, "LRN must be exactly 12 digits.");
      }

      const existingLrn = await Student.findOne({
        lrn: lrn.value,

        _id: {
          $ne: student._id,
        },
      }).lean();

      if (existingLrn) {
        return res.status(409).json({
          ok: false,
          message: "LRN already exists.",
        });
      }

      student.lrn = lrn.value;
    }

    if (body.email !== undefined) {
      const email = safeEmail(body.email);

      if (!email.ok) {
        return badRequest(res);
      }

      if (email.value) {
        const existingEmail = await Student.findOne({
          email: email.value,

          _id: {
            $ne: student._id,
          },
        }).lean();

        if (existingEmail) {
          return res.status(409).json({
            ok: false,
            message: "Email already exists.",
          });
        }
      }

      student.email = email.value || "";
    }

    if (body.phone !== undefined) {
      const phoneRaw = safeString(String(body.phone ?? ""), {
        trim: true,
        min: 0,
        max: 40,
      });

      if (!phoneRaw.ok) {
        return badRequest(res);
      }

      const phone = normalizePHMobile(phoneRaw.value || "");

      if (phoneRaw.value && !phone) {
        return badRequest(res, "Invalid student phone number.");
      }

      student.phone = phone;
    }

    if (!student.address) {
      student.address = {};
    }

    const addressFields = [
      ["street", 150],
      ["provinceCode", 20],
      ["cityCode", 20],
      ["brgyCode", 20],
      ["postal", 12],
    ];

    for (const [k, max] of addressFields) {
      if (body[k] !== undefined) {
        const v = safeString(String(body[k] ?? ""), {
          trim: true,
          min: 0,
          max,
        });

        if (!v.ok) {
          return badRequest(res);
        }

        student.address[k] = v.value;
      }
    }

    if (!student.parents) {
      student.parents = {};
    }

    const parentStringFields = [
      ["fatherName", 80],
      ["fatherOccupation", 80],
      ["motherName", 80],
      ["motherOccupation", 80],
    ];

    for (const [k, max] of parentStringFields) {
      if (body[k] !== undefined) {
        const v = safeString(String(body[k] ?? ""), {
          trim: true,
          min: 0,
          max,
        });

        if (!v.ok) {
          return badRequest(res);
        }

        student.parents[k] = v.value;
      }
    }

    if (body.fatherContact !== undefined) {
      const raw = safeString(String(body.fatherContact ?? ""), {
        trim: true,
        min: 0,
        max: 40,
      });

      if (!raw.ok) {
        return badRequest(res);
      }

      const contact = normalizePHMobile(raw.value || "");

      if (raw.value && !contact) {
        return badRequest(res, "Invalid father contact number.");
      }

      student.parents.fatherContact = contact;
    }

    if (body.motherContact !== undefined) {
      const raw = safeString(String(body.motherContact ?? ""), {
        trim: true,
        min: 0,
        max: 40,
      });

      if (!raw.ok) {
        return badRequest(res);
      }

      const contact = normalizePHMobile(raw.value || "");

      if (raw.value && !contact) {
        return badRequest(res, "Invalid mother contact number.");
      }

      student.parents.motherContact = contact;
    }

    if (body.photoDataUrl !== undefined) {
      const photo = safeString(String(body.photoDataUrl ?? ""), {
        trim: false,
        min: 0,
        max: 20000,
      });

      if (!photo.ok) {
        return badRequest(res);
      }

      student.photoDataUrl = photo.value;
    }

    await student.save();

    res.json({
      ok: true,

      student: serializeStudent(student),
    });
  } catch (err) {
    console.error("updateStudent error:", err);

    res.status(500).json({
      ok: false,
      message: "Failed to update student.",
    });
  }
};

// ============================================================
// RESET STUDENT PASSWORD
// ============================================================

exports.resetStudentPassword = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student not found.",
      });
    }

    const tempPass = generateTempPassword();

    const passwordHash = await argon2.hash(tempPass);

    if (student.userId) {
      await User.updateOne(
        {
          _id: student.userId,
        },
        {
          $set: {
            password_hash: passwordHash,

            must_change_password: true,
          },
        },
      );
    }

    res.json({
      ok: true,
      tempPass,
    });
  } catch (err) {
    console.error("resetStudentPassword error:", err);

    res.status(500).json({
      ok: false,
      message: "Failed to reset password.",
    });
  }
};

// ============================================================
// DISABLE STUDENT
// ============================================================

exports.disableStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student not found.",
      });
    }

    student.isActive = false;

    await student.save();

    if (student.userId) {
      await User.updateOne(
        {
          _id: student.userId,
        },
        {
          $set: {
            status: "disabled",
          },
        },
      );
    }

    res.json({
      ok: true,
    });
  } catch (err) {
    console.error("disableStudent error:", err);

    res.status(500).json({
      ok: false,
      message: "Failed to disable student.",
    });
  }
};

// ============================================================
// DELETE STUDENT
// ============================================================

exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student not found.",
      });
    }

    if (student.userId) {
      await User.deleteOne({
        _id: student.userId,
      });
    }

    await Student.deleteOne({
      _id: student._id,
    });

    res.json({
      ok: true,
    });
  } catch (err) {
    console.error("deleteStudent error:", err);

    res.status(500).json({
      ok: false,
      message: "Failed to delete student.",
    });
  }
};
