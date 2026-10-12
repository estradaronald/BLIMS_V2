// backend/src/controllers/admin.teachers.controller.js
const argon2 = require("argon2");
const Teacher = require("../models/Teacher.model");
const User = require("../models/User.model");
const Counter = require("../models/Counter.model");
const Section = require("../models/Section");

// -----------------------------
// validation helpers
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

function safeEnum(v, allowed) {
  const s = safeString(v, { trim: true, min: 1, max: 30 });
  if (!s.ok) return { ok: false };

  if (!allowed.includes(s.value)) return { ok: false };
  return { ok: true, value: s.value };
}

function safeBoolean(v) {
  if (typeof v === "boolean") return { ok: true, value: v };
  if (v === "true") return { ok: true, value: true };
  if (v === "false") return { ok: true, value: false };
  return { ok: false };
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

// -----------------------------
// helpers
// -----------------------------
function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

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
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
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

exports.getUnassignedTeachers = async (req, res) => {
  try {
    const { sectionId } = req.query;

    const sections = await Section.find(
      { adviserId: { $exists: true, $ne: null } },
      { adviserId: 1 }
    ).lean();

    let assignedIds = sections
      .map((s) => String(s.adviserId || ""))
      .filter(Boolean);

    if (sectionId) {
      const currentSection = await Section.findById(sectionId).lean();
      if (currentSection?.adviserId) {
        assignedIds = assignedIds.filter(
          (id) => id !== String(currentSection.adviserId)
        );
      }
    }

    const teachers = await Teacher.find({
      isActive: true,
      _id: { $nin: assignedIds },
    })
      .select("_id teacherId firstName middleName lastName email")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const result = teachers.map((t) => ({
      id: String(t._id),
      teacherId: t.teacherId || "",
      firstName: t.firstName || "",
      middleName: t.middleName || "",
      lastName: t.lastName || "",
      email: t.email || "",
      name: [t.firstName, t.middleName, t.lastName]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    }));

    return res.json({
      ok: true,
      teachers: result,
    });
  } catch (err) {
    console.error("getUnassignedTeachers error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch teachers.",
    });
  }
};

exports.createTeacher = async (req, res) => {
  let createdUserId = null;

  try {
    if (!isPlainObject(req.body) || hasDangerousKeys(req.body)) {
      return badRequest(res);
    }

    const body = req.body;
    const teacherId = await nextTeacherId();

    const tempPass = generateTempPassword();
    const passwordHash = await argon2.hash(tempPass);

    const usernameInput = safeOptionalString(body.username, {
      trim: true,
      min: 1,
      max: 64,
    });
    if (!usernameInput.ok) return badRequest(res);

    const username = (usernameInput.value || teacherId).trim();

    const existingUser = await User.findOne({ username }).lean();
    if (existingUser) {
      return res.status(409).json({ ok: false, message: "Username already exists." });
    }

    const firstName = safeString(body.firstName ?? "", { trim: true, min: 1, max: 80 });
    const middleName = safeOptionalString(body.middleName ?? "", { trim: true, min: 0, max: 80 });
    const lastName = safeString(body.lastName ?? "", { trim: true, min: 1, max: 80 });
    if (!firstName.ok || !middleName.ok || !lastName.ok) {
      return badRequest(res, "Invalid name fields.");
    }

    const dob = safeString(String(body.dob ?? body.birthDate ?? ""), {
      trim: true,
      min: 1,
      max: 40,
    });
    if (!dob.ok) return badRequest(res, "Date of birth is required.");

    let genderValue = "male";

    if (body.gender !== undefined && body.gender !== null && String(body.gender).trim() !== "") {
      const gender = safeEnum(String(body.gender).toLowerCase(), ["male", "female"]);
      if (!gender.ok) return badRequest(res, "Invalid gender.");
      genderValue = gender.value;
    } else if (body.sex !== undefined && body.sex !== null && String(body.sex).trim() !== "") {
      const sex = safeEnum(String(body.sex), ["Male", "Female"]);
      if (!sex.ok) return badRequest(res, "Invalid sex.");
      genderValue = sex.value === "Female" ? "female" : "male";
    }

    const className = safeOptionalString(
      String(body.className ?? body.gradeLevel ?? ""),
      { trim: true, min: 0, max: 60 }
    );
    const sectionName = safeOptionalString(
      String(body.sectionName ?? body.section ?? ""),
      { trim: true, min: 0, max: 60 }
    );

    if (!className.ok || !sectionName.ok) {
      return badRequest(res, "Invalid class or section.");
    }

    const email = safeEmail(body.email);
    if (!email.ok) return badRequest(res, "Invalid email.");

    const phoneRaw = safeOptionalString(body.phone ?? "", { trim: true, min: 0, max: 40 });
    if (!phoneRaw.ok) return badRequest(res, "Invalid phone.");
    const phone = normalizePHMobile(phoneRaw.value || "");

    const hasPrc = safeBoolean(body.hasPrc ?? false);
    if (!hasPrc.ok) return badRequest(res, "Invalid PRC flag.");

    const prcLicenseNo = safeOptionalString(body.prcLicenseNo ?? "", {
      trim: true,
      min: 0,
      max: 60,
    });
    const position = safeOptionalString(body.position ?? "Teacher", {
      trim: true,
      min: 0,
      max: 80,
    });
    const majorSpec = safeOptionalString(body.majorSpec ?? "", {
      trim: true,
      min: 0,
      max: 100,
    });
    const highestEduc = safeOptionalString(body.highestEduc ?? "", {
      trim: true,
      min: 0,
      max: 100,
    });
    const dateHired = safeOptionalString(body.dateHired ?? "", {
      trim: true,
      min: 0,
      max: 40,
    });

    if (!prcLicenseNo.ok || !position.ok || !majorSpec.ok || !highestEduc.ok || !dateHired.ok) {
      return badRequest(res, "Invalid credential fields.");
    }

    const photoDataUrl = safeOptionalString(body.photoDataUrl ?? "", {
      trim: false,
      min: 0,
      max: 20000,
    });
    if (!photoDataUrl.ok) return badRequest(res, "Invalid photo.");

    const regionCode = safeOptionalString(body.regionCode ?? "", {
      trim: true,
      min: 0,
      max: 20,
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
    const barangayCode = safeOptionalString(body.barangayCode ?? "", {
      trim: true,
      min: 0,
      max: 20,
    });
    const street = safeOptionalString(body.street ?? "", {
      trim: true,
      min: 0,
      max: 150,
    });
    const postalCode = safeOptionalString(body.postalCode ?? "", {
      trim: true,
      min: 0,
      max: 12,
    });

    if (
      !regionCode.ok ||
      !provinceCode.ok ||
      !cityCode.ok ||
      !barangayCode.ok ||
      !street.ok ||
      !postalCode.ok
    ) {
      return badRequest(res, "Invalid address fields.");
    }

    const user = await User.create({
      username,
      role: "teacher",
      password_hash: passwordHash,
      must_change_password: true,
      status: "active",
    });
    createdUserId = user._id;

    const teacherDoc = {
      teacherId,
      userId: user._id,

      firstName: firstName.value,
      middleName: middleName.value || "",
      lastName: lastName.value,
      gender: genderValue,

      dob: dob.value,
      className: className.value || "Unassigned",
      sectionName: sectionName.value || "Unassigned",

      email: email.value || "",
      phone,
      position: position.value || "Teacher",

      address: {
        regionCode: regionCode.value || "",
        provinceCode: provinceCode.value || "",
        cityCode: cityCode.value || "",
        brgyCode: barangayCode.value || "",
        street: street.value || "",
        postal: postalCode.value || "",
      },

      credentials: {
        hasPrc: hasPrc.value,
        prcLicense: hasPrc.value
          ? (prcLicenseNo.value || "")
          : "N/A",
        majorSpec: majorSpec.value || "",
        highestEduc: highestEduc.value || "",
        dateHired: dateHired.value || "",
      },

      photoDataUrl: photoDataUrl.value || "",
      isActive: true,
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
    if (!teacher) {
      return res.status(404).json({ ok: false, message: "Teacher not found." });
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

    if (!firstName.ok || !middleName.ok || !lastName.ok) {
      return badRequest(res, "Invalid name fields.");
    }

    if (firstName.value !== undefined) teacher.firstName = firstName.value;
    if (middleName.value !== undefined) teacher.middleName = middleName.value;
    if (lastName.value !== undefined) teacher.lastName = lastName.value;

    if (body.gender !== undefined) {
      const gender = safeEnum(String(body.gender).toLowerCase(), ["male", "female"]);
      if (!gender.ok) return badRequest(res, "Invalid gender.");
      teacher.gender = gender.value;
    } else if (body.sex !== undefined) {
      const sex = safeEnum(String(body.sex), ["Male", "Female"]);
      if (!sex.ok) return badRequest(res, "Invalid sex.");
      teacher.gender = sex.value === "Female" ? "female" : "male";
    }

    if (body.dob !== undefined || body.birthDate !== undefined) {
      const dob = safeString(String(body.dob ?? body.birthDate ?? ""), {
        trim: true,
        min: 1,
        max: 40,
      });
      if (!dob.ok) return badRequest(res, "Invalid birth date.");
      teacher.dob = dob.value;
    }

    if (body.className !== undefined || body.gradeLevel !== undefined) {
      const className = safeString(String(body.className ?? body.gradeLevel ?? ""), {
        trim: true,
        min: 0,
        max: 60,
      });
      if (!className.ok) return badRequest(res, "Invalid class name.");
      teacher.className = className.value || "Unassigned";
    }

    if (body.sectionName !== undefined || body.section !== undefined) {
      const sectionName = safeString(String(body.sectionName ?? body.section ?? ""), {
        trim: true,
        min: 0,
        max: 60,
      });
      if (!sectionName.ok) return badRequest(res, "Invalid section name.");
      teacher.sectionName = sectionName.value || "Unassigned";
    }

    if (body.email !== undefined) {
      const email = safeEmail(body.email);
      if (!email.ok) return badRequest(res, "Invalid email.");
      teacher.email = email.value || "";
    }

    if (body.phone !== undefined) {
      const phoneRaw = safeString(String(body.phone ?? ""), {
        trim: true,
        min: 0,
        max: 40,
      });
      if (!phoneRaw.ok) return badRequest(res, "Invalid phone.");
      teacher.phone = normalizePHMobile(phoneRaw.value);
    }

    if (body.position !== undefined) {
      const position = safeString(String(body.position ?? ""), {
        trim: true,
        min: 0,
        max: 80,
      });
      if (!position.ok) return badRequest(res, "Invalid position.");
      teacher.position = position.value || "Teacher";
    }

    if (!teacher.credentials) {
      teacher.credentials = {};
    }

    if (body.hasPrc !== undefined) {
      const hasPrc = safeBoolean(body.hasPrc);
      if (!hasPrc.ok) return badRequest(res, "Invalid PRC flag.");
      teacher.credentials.hasPrc = hasPrc.value;

      if (!hasPrc.value) {
        teacher.credentials.prcLicense = "N/A";
      }
    }

    if (body.prcLicenseNo !== undefined) {
      const prc = safeString(String(body.prcLicenseNo ?? ""), {
        trim: true,
        min: 0,
        max: 60,
      });
      if (!prc.ok) return badRequest(res, "Invalid PRC license.");
      teacher.credentials.prcLicense = prc.value || "N/A";
    }

    if (body.majorSpec !== undefined) {
      const majorSpec = safeString(String(body.majorSpec ?? ""), {
        trim: true,
        min: 0,
        max: 100,
      });
      if (!majorSpec.ok) return badRequest(res, "Invalid major.");
      teacher.credentials.majorSpec = majorSpec.value;
    }

    if (body.highestEduc !== undefined) {
      const highestEduc = safeString(String(body.highestEduc ?? ""), {
        trim: true,
        min: 0,
        max: 100,
      });
      if (!highestEduc.ok) return badRequest(res, "Invalid highest education.");
      teacher.credentials.highestEduc = highestEduc.value;
    }

    if (body.dateHired !== undefined) {
      const dateHired = safeString(String(body.dateHired ?? ""), {
        trim: true,
        min: 0,
        max: 40,
      });
      if (!dateHired.ok) return badRequest(res, "Invalid date hired.");
      teacher.credentials.dateHired = dateHired.value;
    }

    if (body.photoDataUrl !== undefined) {
      const photo = safeString(String(body.photoDataUrl ?? ""), {
        trim: false,
        min: 0,
        max: 20000,
      });
      if (!photo.ok) return badRequest(res, "Invalid photo.");
      teacher.photoDataUrl = photo.value;
    }

    if (!teacher.address) {
      teacher.address = {};
    }

    const addrFields = [
      ["regionCode", "regionCode", 20],
      ["provinceCode", "provinceCode", 20],
      ["cityCode", "cityCode", 20],
      ["barangayCode", "brgyCode", 20],
      ["street", "street", 150],
      ["postalCode", "postal", 12],
    ];

    for (const [bodyKey, docKey, max] of addrFields) {
      if (body[bodyKey] !== undefined) {
        const v = safeString(String(body[bodyKey] ?? ""), {
          trim: true,
          min: 0,
          max,
        });
        if (!v.ok) return badRequest(res, `Invalid ${bodyKey}.`);
        teacher.address[docKey] = v.value;
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
    if (!teacher) {
      return res.status(404).json({ ok: false, message: "Teacher not found." });
    }

    const tempPass = generateTempPassword();
    const passwordHash = await argon2.hash(tempPass);

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
    if (!teacher) {
      return res.status(404).json({ ok: false, message: "Teacher not found." });
    }

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

    // Find teacher using either:
    // - Teacher._id
    // - linked User._id
    const teacher = await Teacher.findOne({
      $or: [
        { _id: teacherId },
        { userId: teacherId }
      ]
    });

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher not found."
      });
    }

    // Save the linked User ID before deleting the Teacher
    const userId = teacher.userId;

    // Delete the Teacher record
    await Teacher.deleteOne({
      _id: teacher._id
    });

    // Delete the corresponding login account
    if (userId) {
      await User.deleteOne({
        _id: userId
      });
    }

    return res.json({
      ok: true,
      message: "Teacher deleted successfully."
    });

  } catch (err) {
    console.error("deleteTeacher error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to delete teacher."
    });
  }
};