// backend/src/controllers/admin.teachers.controller.js
const argon2 = require("argon2");
const Teacher = require("../models/Teacher.model");
const User = require("../models/User.model");
const Counter = require("../models/Counter.model");

// -----------------------------
// Category 2 validation helpers
// -----------------------------
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Block common NoSQL injection / prototype pollution surfaces
function hasDangerousKeys(obj) {
  if (!isPlainObject(obj)) return true;

  for (const k of Object.keys(obj)) {
    if (k.startsWith("$")) return true; // Mongo operators
    if (k.includes(".")) return true;   // dotted path injection
    if (k === "__proto__" || k === "constructor" || k === "prototype") return true;
  }
  return false;
}

function safeString(v, { trim = true, min = 0, max = 200 } = {}) {
  if (v === undefined || v === null) return { ok: false };
  if (typeof v !== "string") return { ok: false };
  let s = v;
  if (trim) s = s.trim();
  if (s.length < min) return { ok: false };
  if (s.length > max) return { ok: false };
  return { ok: true, value: s };
}

function safeOptionalString(v, opts) {
  if (v === undefined || v === null) return { ok: true, value: undefined };
  return safeString(v, opts);
}

function safeEnum(v, allowed) {
  const s = safeString(v, { trim: true, min: 1, max: 30 });
  if (!s.ok) return { ok: false };
  const val = s.value;
  if (!allowed.includes(val)) return { ok: false };
  return { ok: true, value: val };
}

function safeEmail(v) {
  const s = safeOptionalString(v, { trim: true, min: 0, max: 254 });
  if (!s.ok) return { ok: false };
  if (s.value === undefined || s.value === "") return { ok: true, value: "" };
  // basic email format check (not perfect, but good enough for validation)
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.value);
  if (!ok) return { ok: false };
  return { ok: true, value: s.value.toLowerCase() };
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

// -----------------------------
// existing helpers
// -----------------------------
function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

/**
 * Normalize PH mobile to +63XXXXXXXXXX
 */
function normalizePHMobile(input) {
  const d = digitsOnly(input);

  if (d.length === 11 && d.startsWith("09")) return "+63" + d.slice(1);
  if (d.length === 10 && d.startsWith("9")) return "+63" + d;
  if (d.length === 12 && d.startsWith("63")) return "+63" + d.slice(2);
  if (d.length === 13 && d.startsWith("063")) return "+63" + d.slice(3);

  if (d.length > 10) {
    const last10 = d.slice(-10);
    if (last10.startsWith("9")) return "+63" + last10;
  }

  return d ? "+63" + d : "";
}

async function nextTeacherId() {
  const counter = await Counter.findOneAndUpdate(
    { key: "teacherId" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  const n = counter?.seq || 1;
  const padded = String(n).padStart(4, "0");
  return `TCH-${padded}`;
}

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// -----------------------------
// controllers
// -----------------------------
exports.listTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({}).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, teachers });
  } catch (err) {
    console.error("listTeachers error:", err);
    res.status(500).json({ ok: false, message: "Failed to load teachers." });
  }
};

exports.createTeacher = async (req, res) => {
  let createdUserId = null;

  try {
    // ✅ body must be plain object, no dangerous keys
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const body = req.body;
    const teacherId = await nextTeacherId();

    // ✅ temp password
    const tempPass = generateTempPassword();
    const passwordHash = await argon2.hash(tempPass);

    // username defaults to teacherId
    const u = safeOptionalString(body.username, { trim: true, min: 1, max: 64 });
    if (!u.ok) return badRequest(res);
    const username = (u.value || teacherId).trim();

    const existingUser = await User.findOne({ username }).lean();
    if (existingUser) {
      return res.status(409).json({ ok: false, message: "Username already exists." });
    }

    // Validate key fields used by schema (based on your code comment)
    const firstName = safeString(body.firstName ?? "", { trim: true, min: 0, max: 80 });
    const middleName = safeString(body.middleName ?? "", { trim: true, min: 0, max: 80 });
    const lastName = safeString(body.lastName ?? "", { trim: true, min: 0, max: 80 });
    if (!firstName.ok || !middleName.ok || !lastName.ok) return badRequest(res);

    // sex: allow common values; if your app uses different values, adjust allowed list
    let sexValue = "";
    if (body.sex !== undefined && body.sex !== null && String(body.sex).trim() !== "") {
      const sex = safeEnum(String(body.sex), ["Male", "Female"]);
      if (!sex.ok) return badRequest(res);
      sexValue = sex.value;
    }

    // REQUIRED fields in your code: dob/className/sectionName must be non-empty string
    const dob = safeString(String(body.dob ?? body.birthDate ?? ""), { trim: true, min: 1, max: 40 });
    const className = safeString(String(body.className ?? body.gradeLevel ?? ""), { trim: true, min: 1, max: 60 });
    const sectionName = safeString(String(body.sectionName ?? body.section ?? ""), { trim: true, min: 1, max: 60 });
    if (!dob.ok || !className.ok || !sectionName.ok) return badRequest(res);

    const email = safeEmail(body.email);
    if (!email.ok) return badRequest(res);

    const phoneRaw = safeOptionalString(body.phone ?? "", { trim: true, min: 0, max: 40 });
    if (!phoneRaw.ok) return badRequest(res);
    const phone = normalizePHMobile(phoneRaw.value || "");

    const prc = safeOptionalString(body.prcLicenseNo ?? "", { trim: true, min: 0, max: 60 });
    const pos = safeOptionalString(body.position ?? "", { trim: true, min: 0, max: 80 });
    if (!prc.ok || !pos.ok) return badRequest(res);

    const credentials = safeOptionalString(body.credentials ?? "", { trim: true, min: 0, max: 500 });
    if (!credentials.ok) return badRequest(res);

    // NOTE: photoDataUrl can be large; your server currently limits /api to 20kb
    const photoDataUrl = safeOptionalString(body.photoDataUrl ?? "", { trim: false, min: 0, max: 20000 });
    if (!photoDataUrl.ok) return badRequest(res);

    // Address codes / fields
    const regionCode = safeOptionalString(body.regionCode ?? "", { trim: true, min: 0, max: 20 });
    const provinceCode = safeOptionalString(body.provinceCode ?? "", { trim: true, min: 0, max: 20 });
    const cityCode = safeOptionalString(body.cityCode ?? "", { trim: true, min: 0, max: 20 });
    const barangayCode = safeOptionalString(body.barangayCode ?? "", { trim: true, min: 0, max: 20 });
    const street = safeOptionalString(body.street ?? "", { trim: true, min: 0, max: 150 });
    const postalCode = safeOptionalString(body.postalCode ?? "", { trim: true, min: 0, max: 12 });
    if (
      !regionCode.ok || !provinceCode.ok || !cityCode.ok || !barangayCode.ok ||
      !street.ok || !postalCode.ok
    ) return badRequest(res);

    // ✅ 1) Create User FIRST
    const user = await User.create({
      username,
      role: "teacher",
      password_hash: passwordHash,
      must_change_password: true,
      status: "active",
    });
    createdUserId = user._id;

    // ✅ 2) Create Teacher
    const teacherDoc = {
      teacherId,
      userId: user._id,

      firstName: firstName.value,
      middleName: middleName.value,
      lastName: lastName.value,
      sex: sexValue,

      dob: dob.value,
      className: className.value,
      sectionName: sectionName.value,

      email: email.value || "",
      phone,
      prcLicenseNo: prc.value || "",
      position: pos.value || "",

      address: {
        regionCode: regionCode.value || "",
        provinceCode: provinceCode.value || "",
        cityCode: cityCode.value || "",
        barangayCode: barangayCode.value || "",
        street: street.value || "",
        postalCode: postalCode.value || "",
      },

      credentials: credentials.value || "",
      photoDataUrl: photoDataUrl.value || "",
      isActive: true,

      // keep if your schema includes passwordHash
      passwordHash,
    };

    const teacher = await Teacher.create(teacherDoc);

    res.status(201).json({
      ok: true,
      teacher,
      tempPass,
    });
  } catch (err) {
    console.error("createTeacher error:", err);

    if (createdUserId) {
      try {
        await User.deleteOne({ _id: createdUserId });
      } catch {}
    }

    res.status(500).json({ ok: false, message: "Failed to create teacher." });
  }
};

exports.updateTeacher = async (req, res) => {
  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const { teacherId } = req.params;
    const body = req.body;

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) return res.status(404).json({ ok: false, message: "Teacher not found." });

    // Only accept string fields; reject objects/arrays for these
    const setIfProvided = (key, opts) => {
      if (body[key] === undefined || body[key] === null) return { ok: true, value: undefined };
      if (isPlainObject(body[key]) || Array.isArray(body[key])) return { ok: false };
      return safeString(String(body[key]), opts);
    };

    const firstName = setIfProvided("firstName", { trim: true, min: 0, max: 80 });
    const middleName = setIfProvided("middleName", { trim: true, min: 0, max: 80 });
    const lastName = setIfProvided("lastName", { trim: true, min: 0, max: 80 });
    if (!firstName.ok || !middleName.ok || !lastName.ok) return badRequest(res);

    // sex (optional)
    if (body.sex !== undefined && body.sex !== null) {
      if (String(body.sex).trim() === "") {
        teacher.sex = "";
      } else {
        const sex = safeEnum(String(body.sex), ["Male", "Female"]);
        if (!sex.ok) return badRequest(res);
        teacher.sex = sex.value;
      }
    }

    // schema fields
    if (body.dob !== undefined || body.birthDate !== undefined) {
      const dob = safeString(String(body.dob ?? body.birthDate ?? ""), { trim: true, min: 1, max: 40 });
      if (!dob.ok) return badRequest(res);
      teacher.dob = dob.value;
    }

    if (body.className !== undefined || body.gradeLevel !== undefined) {
      const className = safeString(String(body.className ?? body.gradeLevel ?? ""), { trim: true, min: 1, max: 60 });
      if (!className.ok) return badRequest(res);
      teacher.className = className.value;
    }

    if (body.sectionName !== undefined || body.section !== undefined) {
      const sectionName = safeString(String(body.sectionName ?? body.section ?? ""), { trim: true, min: 1, max: 60 });
      if (!sectionName.ok) return badRequest(res);
      teacher.sectionName = sectionName.value;
    }

    // simple strings
    if (firstName.value !== undefined) teacher.firstName = firstName.value;
    if (middleName.value !== undefined) teacher.middleName = middleName.value;
    if (lastName.value !== undefined) teacher.lastName = lastName.value;

    if (body.email !== undefined) {
      const email = safeEmail(body.email);
      if (!email.ok) return badRequest(res);
      teacher.email = email.value || "";
    }

    if (body.phone !== undefined) {
      const phoneRaw = safeString(String(body.phone ?? ""), { trim: true, min: 0, max: 40 });
      if (!phoneRaw.ok) return badRequest(res);
      teacher.phone = normalizePHMobile(phoneRaw.value);
    }

    if (body.prcLicenseNo !== undefined) {
      const prc = safeString(String(body.prcLicenseNo ?? ""), { trim: true, min: 0, max: 60 });
      if (!prc.ok) return badRequest(res);
      teacher.prcLicenseNo = prc.value;
    }

    if (body.position !== undefined) {
      const pos = safeString(String(body.position ?? ""), { trim: true, min: 0, max: 80 });
      if (!pos.ok) return badRequest(res);
      teacher.position = pos.value;
    }

    if (body.credentials !== undefined) {
      const credentials = safeString(String(body.credentials ?? ""), { trim: true, min: 0, max: 500 });
      if (!credentials.ok) return badRequest(res);
      teacher.credentials = credentials.value;
    }

    if (body.photoDataUrl !== undefined) {
      const photo = safeString(String(body.photoDataUrl ?? ""), { trim: false, min: 0, max: 20000 });
      if (!photo.ok) return badRequest(res);
      teacher.photoDataUrl = photo.value;
    }

    // address
    if (!teacher.address) teacher.address = {};

    const addrFields = [
      ["regionCode", 20],
      ["provinceCode", 20],
      ["cityCode", 20],
      ["barangayCode", 20],
      ["street", 150],
      ["postalCode", 12],
    ];

    for (const [k, max] of addrFields) {
      if (body[k] !== undefined) {
        const v = safeString(String(body[k] ?? ""), { trim: true, min: 0, max });
        if (!v.ok) return badRequest(res);
        teacher.address[k] = v.value;
      }
    }

    await teacher.save();
    res.json({ ok: true, teacher });
  } catch (err) {
    console.error("updateTeacher error:", err);
    res.status(500).json({ ok: false, message: "Failed to update teacher." });
  }
};

exports.resetTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) return res.status(404).json({ ok: false, message: "Teacher not found." });

    const tempPass = generateTempPassword();
    const passwordHash = await argon2.hash(tempPass);

    teacher.passwordHash = passwordHash;
    await teacher.save();

    if (teacher.userId) {
      await User.updateOne(
        { _id: teacher.userId },
        { $set: { password_hash: passwordHash, must_change_password: true } }
      );
    }

    res.json({ ok: true, tempPass });
  } catch (err) {
    console.error("resetTeacherPassword error:", err);
    res.status(500).json({ ok: false, message: "Failed to reset password." });
  }
};

exports.disableTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) return res.status(404).json({ ok: false, message: "Teacher not found." });

    teacher.isActive = false;
    await teacher.save();

    if (teacher.userId) {
      await User.updateOne({ _id: teacher.userId }, { $set: { status: "disabled" } });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("disableTeacher error:", err);
    res.status(500).json({ ok: false, message: "Failed to disable teacher." });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) return res.status(404).json({ ok: false, message: "Teacher not found." });

    if (teacher.userId) {
      await User.deleteOne({ _id: teacher.userId });
    }

    await Teacher.deleteOne({ teacherId });

    res.json({ ok: true });
  } catch (err) {
    console.error("deleteTeacher error:", err);
    res.status(500).json({ ok: false, message: "Failed to delete teacher." });
  }
};