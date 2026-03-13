const express = require("express");
const router = express.Router();

const controller = require("../controllers/admin.school-years.controller");

router.get("/school-years", controller.getSchoolYears);
router.get("/school-years/active", controller.getActiveSchoolYear);
router.post("/school-years", controller.createSchoolYear);
router.patch("/school-years/:id/active", controller.setActiveSchoolYear);
router.put("/school-years/:id/quarters", controller.updateQuarters);

module.exports = router;