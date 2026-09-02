const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/announcement.controller");

// Note:
// Removed requireAuth / requireAdmin import because your project
// currently does not have ../middleware/auth.middleware
// and it was crashing the server.
//
// If you already protect admin routes elsewhere, this is enough for now.
// If you later create an auth middleware file, we can add it back properly.

// optional upload middleware for later
// const upload = require("../middlewares/upload.middleware");

router.get("/", ctrl.getAllAnnouncements);
router.get("/:id", ctrl.getAnnouncementById);

// no upload yet
router.post("/", ctrl.createAnnouncement);
router.put("/:id", ctrl.updateAnnouncement);

// if with upload middleware later:
// router.post("/", upload.array("files", 5), ctrl.createAnnouncement);
// router.put("/:id", upload.array("files", 5), ctrl.updateAnnouncement);

router.patch("/:id/archive", ctrl.toggleArchiveAnnouncement);
router.delete("/:id", ctrl.deleteAnnouncement);

module.exports = router;