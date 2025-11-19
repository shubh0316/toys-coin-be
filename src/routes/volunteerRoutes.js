const express = require('express');
const router = express.Router();
const { registerVolunteer } = require("../controllers/volunteer/volunteerController");
const { loginVolunteer } = require("../controllers/auth/volunteerAuthController")
const  { getAllVolunteer } = require("../controllers/volunteer/getAllVolunteerController");
const { getVolunteerById } = require("../controllers/volunteer/getVolunteerByIdController");
const { updateVolunteerById } = require('../controllers/volunteer/updateVolunteerByIdController');
// Volunteer Authentication
router.post('/register', registerVolunteer);
router.post('/login', loginVolunteer);
router.get('/getAllVolunteers', getAllVolunteer);
router.get('/:id', getVolunteerById);
router.patch('/:id', updateVolunteerById);
module.exports = router;
