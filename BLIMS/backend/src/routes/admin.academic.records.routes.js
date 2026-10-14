const express = require("express");
const router = express.Router();

const {
  getAcademicRecords,
} = require("../controllers/admin.academic.records.controller");

router.get("/", getAcademicRecords);

module.exports = router;