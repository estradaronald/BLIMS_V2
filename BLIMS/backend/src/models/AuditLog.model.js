const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    // actor
    actor_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actor_username: { type: String, default: "" },
    actor_role: { type: String, default: "" },

    // action
    action: { type: String, required: true }, // e.g., AUTH_LOGIN_SUCCESS
    outcome: { type: String, enum: ["SUCCESS", "FAIL", "INFO"], default: "INFO" },
    message: { type: String, default: "" },

    // request context
    ip: { type: String, default: "" },
    user_agent: { type: String, default: "" },
    path: { type: String, default: "" },

    // optional safe extra data
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);