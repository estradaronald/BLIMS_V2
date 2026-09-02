const express = require("express");

const router = express.Router();

const controller = require("../controllers/admin.school-years.controller");


/* =========================================================
   SCHOOL YEARS
========================================================= */

router.get(
  "/school-years",
  controller.getSchoolYears
);


router.get(
  "/school-years/active",
  controller.getActiveSchoolYear
);


router.post(
  "/school-years",
  controller.createSchoolYear
);


/* =========================================================
   ACTIVE SCHOOL YEAR
========================================================= */

router.patch(
  "/school-years/:id/active",
  controller.setActiveSchoolYear
);


/* =========================================================
   TERMS
========================================================= */

router.put(
  "/school-years/:id/terms",
  controller.updateTerms
);


/* =========================================================
   DELETE SCHOOL YEAR
========================================================= */

router.delete(
  "/school-years/:id",
  controller.deleteSchoolYear
);


module.exports = router;