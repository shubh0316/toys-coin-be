const express = require('express');
const { sendInvite } = require('../controllers/admin/adminController');
const { adminLogin } = require('../controllers/auth/adminauthController'); // Fixed the casing of the file name
const { getAllInvites } = require('../controllers/admin/getAllAgenciesInvitedController');

const router = express.Router();
router.post('/login', adminLogin)
router.post('/invite-admin', sendInvite);
router.get('/invites', getAllInvites);

module.exports = router;
