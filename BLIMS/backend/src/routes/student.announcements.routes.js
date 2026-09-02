const express = require("express");

const router =
  express.Router();

const studentAnnouncementController =
  require("../controllers/student.announcement.controller");


/* =========================================================
   STUDENT ANNOUNCEMENTS
========================================================= */


/*
  GET /api/student/announcements

  Get all announcements visible
  to the authenticated student.
*/

router.get(
  "/",
  studentAnnouncementController.getStudentAnnouncements
);


/*
  GET /api/student/announcements/:id

  Get one announcement visible
  to the authenticated student.
*/

router.get(
  "/:id",
  studentAnnouncementController.getStudentAnnouncementById
);


module.exports = router;