const express = require("express");
const router = express.Router();
const agencyController = require("../controllers/agencyController");
const { updateAgencyById } = require("../controllers/updateAgencyByIdController");

// API Endpoints
router.post("/invite-agency", agencyController.inviteAgency);
router.post("/submit-details", agencyController.submitDetails);
router.post("/review-agency", agencyController.reviewAgency);
router.post("/pause-agency", agencyController.pauseAgency);
router.post("/login", agencyController.loginAgency);
router.get("/nearby", agencyController.filterAgenciesByRadius);
router.get("/agencies", agencyController.getAllAgencies);
router.get("/agency/:id", agencyController.getAgencyById);
router.patch("/agency/:id", updateAgencyById);

module.exports = router;
