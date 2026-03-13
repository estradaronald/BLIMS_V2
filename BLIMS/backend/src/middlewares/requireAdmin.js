module.exports = function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Forbidden" });
  }
  next();
};