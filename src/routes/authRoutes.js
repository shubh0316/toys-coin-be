const express = require('express');
const { requestPasswordReset, resetPassword } = require('../controllers/auth/forgotPasswordController');

const router = express.Router();

// ✅ Public routes - No authentication required
// These routes are accessible to users who are not logged in
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);

module.exports = router;
