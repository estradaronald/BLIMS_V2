const express = require("express");

const router = express.Router();

const teacherPromotionController =
  require("../controllers/teacherPromotion.controller");


/* =========================================================
   TEACHER PROMOTION
========================================================= */

// Get teacher's assigned class,
// final term, learners, final grades,
// and existing recommendations.

router.get(
  "/",
  teacherPromotionController.getPromotionData
);


// Submit promotion recommendations.

router.post(
  "/submit",
  teacherPromotionController.submitPromotion
);


module.exports = router;