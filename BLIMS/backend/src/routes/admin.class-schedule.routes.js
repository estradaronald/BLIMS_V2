const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/admin.class-schedule.controller");

router.get("/class-schedules", ctrl.getSchedules);
router.post("/class-schedules", ctrl.createDaySchedule);
router.put("/class-schedules/:grade/:section/:day", ctrl.updateDaySchedule);
router.delete("/class-schedules/entry/:id", ctrl.deleteScheduleEntry);
router.delete("/class-schedules/:grade/:section/:day", ctrl.deleteDaySchedule);

module.exports = router;