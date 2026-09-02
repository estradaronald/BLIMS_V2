// backend/routes/event.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/event.controller");

router.get("/", ctrl.getEvents);
router.post("/", ctrl.createEvent);
router.put("/:id", ctrl.updateEvent);
router.delete("/:id", ctrl.deleteEvent);

module.exports = router;