const argon2 = require("argon2");
const Student = require("../models/Student.model");
const User = require("../models/User.model");
const Counter = require("../models/Counter.model");

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

function safeEmail(v) {
  const s = safeOptionalString(v, { trim: true, min: 0, max: 254 });
  if (!s.ok) return { ok: false };
  if (s.value === undefined || s.value === "") return { ok: true, value: "" };

  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.value);
  if (!ok) return { ok: false };

  return { ok: true, value: s.value.toLowerCase() };
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizePHMobile(input) {
  const d = digitsOnly(input);

  if (!d) return "";
  if (d.length === 11 && d.startsWith("09")) return "+63" + d.slice(1);
  if (d.length === 10 && d.startsWith("9")) return "+63" + d;
  if (d.length === 12 && d.startsWith("63")) return "+63" + d.slice(2);
  if (d.length === 13 && d.startsWith("063")) return "+63" + d.slice(3);

  if (d.length > 10) {
    const last10 = d.slice(-10);
    if (last10.startsWith("9")) return "+63" + last10;
  }

  return "";
}

async function nextStudentId() {
  const counter = await Counter.findOneAndUpdate(
    { key: "studentId" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  const n = counter?.seq || 1;
  return `STD-${String(n).padStart(4, "0")}`;
}

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

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

// -----------------------------
// List students
// -----------------------------
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
          String(s.studentId || "").toLowerCase().includes(needle) ||
          String(s.lrn || "").toLowerCase().includes(needle)
        );
      });
    }

    res.json({
      ok: true,
      students: students.map(serializeStudent),
    });
  } catch (err) {
    console.error("listStudents error:", err);
    res.status(500).json({ ok: false, message: "Failed to load students." });
  }
};

// -----------------------------
// Create student
// -----------------------------
exports.createStudent = async (req, res) => {
  let createdUserId = null;

  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const body = req.body;
    const studentId = await nextStudentId();

    const tempPass = generateTempPassword();
    const passwordHash = await argon2.hash(tempPass);

    const username = studentId;

    const existingUser = await User.findOne({ username }).lean();
    if (existingUser) {
      return res.status(409).json({ ok: false, message: "Username already exists." });
    }

    const firstName = safeString(body.firstName ?? "", { trim: true, min: 1, max: 80 });
    const middleName = safeString(body.middleName ?? "", { trim: true, min: 0, max: 80 });
    const lastName = safeString(body.lastName ?? "", { trim: true, min: 1, max: 80 });

    const genderRaw = safeOptionalString(body.gender ?? "male", {
      trim: true,
      min: 1,
      max: 10,
    });

    const dob = safeOptionalString(body.dob ?? "", { trim: true, min: 0, max: 40 });
    const lrn = safeString(body.lrn ?? "", { trim: true, min: 12, max: 12 });
    const className = safeString(body.className ?? "", { trim: true, min: 1, max: 60 });
    const sectionName = safeString(body.sectionName ?? "", { trim: true, min: 1, max: 60 });

    const email = safeEmail(body.email ?? "");
    const phoneRaw = safeOptionalString(body.phone ?? "", { trim: true, min: 0, max: 40 });

    const street = safeOptionalString(body.street ?? "", { trim: true, min: 0, max: 150 });
    const provinceCode = safeOptionalString(body.provinceCode ?? "", { trim: true, min: 0, max: 20 });
    const cityCode = safeOptionalString(body.cityCode ?? "", { trim: true, min: 0, max: 20 });
    const brgyCode = safeOptionalString(body.brgyCode ?? "", { trim: true, min: 0, max: 20 });
    const postal = safeOptionalString(body.postal ?? "", { trim: true, min: 0, max: 12 });

    const fatherName = safeOptionalString(body.fatherName ?? "", { trim: true, min: 0, max: 80 });
    const fatherOccupation = safeOptionalString(body.fatherOccupation ?? "", { trim: true, min: 0, max: 80 });
    const fatherContactRaw = safeOptionalString(body.fatherContact ?? "", { trim: true, min: 0, max: 40 });

    const motherName = safeOptionalString(body.motherName ?? "", { trim: true, min: 0, max: 80 });
    const motherOccupation = safeOptionalString(body.motherOccupation ?? "", { trim: true, min: 0, max: 80 });
    const motherContactRaw = safeOptionalString(body.motherContact ?? "", { trim: true, min: 0, max: 40 });

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

    const existingLrn = await Student.findOne({ lrn: lrn.value }).lean();
    if (existingLrn) {
      return res.status(409).json({ ok: false, message: "LRN already exists." });
    }

    if (email.value) {
      const existingEmail = await Student.findOne({ email: email.value }).lean();
      if (existingEmail) {
        return res.status(409).json({ ok: false, message: "Email already exists." });
      }
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

      className: className.value,
      sectionName: sectionName.value,

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

    res.status(201).json({
      ok: true,
      student: serializeStudent(student),
      tempPass,
    });
  } catch (err) {
    console.error("createStudent error:", err);

    if (createdUserId) {
      try {
        await User.deleteOne({ _id: createdUserId });
      } catch {}
    }

    res.status(500).json({ ok: false, message: "Failed to create student." });
  }
};

// -----------------------------
// Update student
// -----------------------------
exports.updateStudent = async (req, res) => {
  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const { studentId } = req.params;
    const body = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

    const setIfProvided = (key, opts) => {
      if (body[key] === undefined || body[key] === null) {
        return { ok: true, value: undefined };
      }
      if (isPlainObject(body[key]) || Array.isArray(body[key])) {
        return { ok: false };
      }
      return safeString(String(body[key]), opts);
    };

    const firstName = setIfProvided("firstName", { trim: true, min: 1, max: 80 });
    const middleName = setIfProvided("middleName", { trim: true, min: 0, max: 80 });
    const lastName = setIfProvided("lastName", { trim: true, min: 1, max: 80 });
    const dob = setIfProvided("dob", { trim: true, min: 0, max: 40 });
    const lrn = setIfProvided("lrn", { trim: true, min: 12, max: 12 });
    const className = setIfProvided("className", { trim: true, min: 1, max: 60 });
    const sectionName = setIfProvided("sectionName", { trim: true, min: 1, max: 60 });

    if (!firstName.ok || !middleName.ok || !lastName.ok || !dob.ok || !lrn.ok || !className.ok || !sectionName.ok) {
      return badRequest(res);
    }

    if (body.gender !== undefined) {
      const g = String(body.gender || "").trim().toLowerCase();
      if (!["male", "female"].includes(g)) return badRequest(res, "Invalid gender.");
      student.gender = g;
    }

    if (firstName.value !== undefined) student.firstName = firstName.value;
    if (middleName.value !== undefined) student.middleName = middleName.value;
    if (lastName.value !== undefined) student.lastName = lastName.value;
    if (dob.value !== undefined) student.dob = dob.value;
    if (className.value !== undefined) student.className = className.value;
    if (sectionName.value !== undefined) student.sectionName = sectionName.value;

    if (lrn.value !== undefined) {
      if (!/^\d{12}$/.test(lrn.value)) {
        return badRequest(res, "LRN must be exactly 12 digits.");
      }

      const existingLrn = await Student.findOne({
        lrn: lrn.value,
        _id: { $ne: student._id },
      }).lean();

      if (existingLrn) {
        return res.status(409).json({ ok: false, message: "LRN already exists." });
      }

      student.lrn = lrn.value;
    }

    if (body.email !== undefined) {
      const email = safeEmail(body.email);
      if (!email.ok) return badRequest(res);

      if (email.value) {
        const existingEmail = await Student.findOne({
          email: email.value,
          _id: { $ne: student._id },
        }).lean();

        if (existingEmail) {
          return res.status(409).json({ ok: false, message: "Email already exists." });
        }
      }

      student.email = email.value || "";
    }

    if (body.phone !== undefined) {
      const phoneRaw = safeString(String(body.phone ?? ""), { trim: true, min: 0, max: 40 });
      if (!phoneRaw.ok) return badRequest(res);

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
        const v = safeString(String(body[k] ?? ""), { trim: true, min: 0, max });
        if (!v.ok) return badRequest(res);
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
        const v = safeString(String(body[k] ?? ""), { trim: true, min: 0, max });
        if (!v.ok) return badRequest(res);
        student.parents[k] = v.value;
      }
    }

    if (body.fatherContact !== undefined) {
      const raw = safeString(String(body.fatherContact ?? ""), { trim: true, min: 0, max: 40 });
      if (!raw.ok) return badRequest(res);
      const contact = normalizePHMobile(raw.value || "");
      if (raw.value && !contact) return badRequest(res, "Invalid father contact number.");
      student.parents.fatherContact = contact;
    }

    if (body.motherContact !== undefined) {
      const raw = safeString(String(body.motherContact ?? ""), { trim: true, min: 0, max: 40 });
      if (!raw.ok) return badRequest(res);
      const contact = normalizePHMobile(raw.value || "");
      if (raw.value && !contact) return badRequest(res, "Invalid mother contact number.");
      student.parents.motherContact = contact;
    }

    if (body.photoDataUrl !== undefined) {
      const photo = safeString(String(body.photoDataUrl ?? ""), {
        trim: false,
        min: 0,
        max: 20000,
      });
      if (!photo.ok) return badRequest(res);
      student.photoDataUrl = photo.value;
    }

    await student.save();

    res.json({
      ok: true,
      student: serializeStudent(student),
    });
  } catch (err) {
    console.error("updateStudent error:", err);
    res.status(500).json({ ok: false, message: "Failed to update student." });
  }
};

// -----------------------------
// Reset student password
// -----------------------------
exports.resetStudentPassword = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

    const tempPass = generateTempPassword();
    const passwordHash = await argon2.hash(tempPass);

    if (student.userId) {
      await User.updateOne(
        { _id: student.userId },
        {
          $set: {
            password_hash: passwordHash,
            must_change_password: true,
          },
        }
      );
    }

    res.json({ ok: true, tempPass });
  } catch (err) {
    console.error("resetStudentPassword error:", err);
    res.status(500).json({ ok: false, message: "Failed to reset password." });
  }
};

// -----------------------------
// Disable student
// -----------------------------
exports.disableStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

    student.isActive = false;
    await student.save();

    if (student.userId) {
      await User.updateOne(
        { _id: student.userId },
        { $set: { status: "disabled" } }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("disableStudent error:", err);
    res.status(500).json({ ok: false, message: "Failed to disable student." });
  }
};

// -----------------------------
// Delete student
// -----------------------------
exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

    if (student.userId) {
      await User.deleteOne({ _id: student.userId });
    }

    await Student.deleteOne({ _id: student._id });

    res.json({ ok: true });
  } catch (err) {
    console.error("deleteStudent error:", err);
    res.status(500).json({ ok: false, message: "Failed to delete student." });
  }
};