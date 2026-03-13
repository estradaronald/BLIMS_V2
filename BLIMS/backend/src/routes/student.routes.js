const router = require("express").Router();

const ctrl = require("../controllers/student.controller");

const { requireRole } = require("../middlewares/rbac");

router.use(requireRole("Admin"));

router.get("/students", ctrl.listStudents);

router.post("/students", ctrl.createStudent);

router.delete("/students/:studentId", ctrl.deleteStudent);

module.exports = router;