const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/teacher.announcement.controller");


/*
 * =========================================================
 * TEACHER ANNOUNCEMENTS
 * =========================================================
 *
 * Teacher announcements use the dedicated teacher controller.
 *
 * My Class:
 *   - Create
 *   - View
 *   - Edit
 *   - Archive / Unarchive
 *   - Delete
 *
 * Admin:
 *   - View only
 *
 * Teacher announcements ALWAYS use:
 *
 *   audience: "class"
 *
 * with:
 *
 *   className
 *   sectionName
 *
 * The backend determines/enforces the teacher's scope.
 */


/* =========================================================
   GET ALL
========================================================= */

router.get(
  "/",
  ctrl.getTeacherAnnouncements
);


/* =========================================================
   GET ONE
========================================================= */

router.get(
  "/:id",
  ctrl.getTeacherAnnouncementById
);


/* =========================================================
   CREATE
========================================================= */

router.post(
  "/",
  ctrl.createTeacherAnnouncement
);


/* =========================================================
   UPDATE
========================================================= */

router.put(
  "/:id",
  ctrl.updateTeacherAnnouncement
);


/* =========================================================
   ARCHIVE / UNARCHIVE
========================================================= */

router.patch(
  "/:id/archive",
  ctrl.toggleTeacherArchiveAnnouncement
);


/* =========================================================
   DELETE
========================================================= */

router.delete(
  "/:id",
  ctrl.deleteTeacherAnnouncement
);


module.exports = router;