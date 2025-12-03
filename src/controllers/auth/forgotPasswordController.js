const AdminLogin = require('../../models/AdminLogin');
const Agency = require('../../models/Agency');
const Volunteer = require('../../models/Volunteer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../../utils/mailer');

// Simple helper to introduce an artificial delay before DB operations
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to find user in any model
const findUserByEmail = async (email) => {
    // Artificial delay before querying the database
    await delay(500);
    let user = await AdminLogin.findOne({ email });   
    if (user) return { model: AdminLogin, user };

    // Artificial delay before querying the database
    await delay(500);
    user = await Agency.findOne({ contact_email: email });
    if (user) return { model: Agency, user };

    // Artificial delay before querying the database
    await delay(500);
    user = await Volunteer.findOne({ contact_email: email });
    if (user) return { model: Volunteer, user };

    return null;
};

// Request Password Reset (Sends Email)
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const userData = await findUserByEmail(email);
        if (!userData) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({ message: 'If an account exists with this email, a password reset link has been sent.' });
        }

        const { user } = userData;
        const userEmail = user.email || user.contact_email;

        // Generate Password Reset Token (NOT a login/session token)
        // This token is generated based on the email address, NOT a user session
        // It's a one-time use token that expires in 15 minutes
        // No login is required - the user just needs to provide their email
        const resetToken = jwt.sign({ email: userEmail }, process.env.JWT_SECRET, { expiresIn: '15m' });

        // Send Email with Reset Link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/v/reset-password?token=${resetToken}`;
        const logoUrl = process.env.LOGO_URL || `${frontendUrl}/logo.png`; // Update with your actual logo URL

        await sendMail({
            to: userEmail,
            subject: 'Password Reset Request - Foster Toys',
            text: `Hello there,\n\nYou requested to reset your password for your Foster Toys account. Click the link below to reset it:\n\n${resetLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this password reset, please ignore this email.\n\nThank you,\nThe Foster Toys Team`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset Request</title>
</head>

<body style="margin:0; padding:0; background:#F4E8D5; font-family: Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#F4E8D5">
    <tr>
      <td align="center" style="padding: 40px 20px 20px 20px;">
        
        <!-- MAIN CONTAINER -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#F4E8D5" style="max-width:600px;">
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <!-- LOGO -->
              <img src="${logoUrl}" 
                   alt="Foster Toys Logo" 
                   width="180"
                   style="display:block; margin:0 auto;">
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding: 0 30px 20px 30px; color:#333; font-size:16px; line-height:24px;">
              
              <p>Hello there,</p>

              <p>
                You requested to reset your password for your Foster Toys account. 
                Click the button below to reset your password:
              </p>

              <!-- RESET PASSWORD BUTTON (shadcn button style) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 16px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin-top: 20px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="word-break: break-all; color:#666; font-size:14px; background-color:#fff; padding:10px; border-radius:8px;">
                ${resetLink}
              </p>

              <p style="color:#999; font-size: 12px; margin-top: 20px;">
                <strong>Important:</strong> This link will expire in 15 minutes for security reasons.
              </p>

              <p style="color:#999; font-size: 12px;">
                If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </p>

              <p style="margin-top: 30px;">Thank you,<br>
              The Foster Toys Team</p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
                       <td align="center" style="padding: 40px 30px 20px 30px; color:#555; font-size:12px; line-height:20px; text-align:center;">

              <strong>FOSTER TOYS, INC.</strong><br>
              1100 11TH STREET, SACRAMENTO CA. 95814<br><br>
              FOSTER TOYS, INC. IS A 501(c)3 TAX-EXEMPT<br>
              NONPROFIT ORGANIZATION<br>
              TAX ID 39-3621457<br><br>

              ©2025 FOSTER TOYS, INC. ALL RIGHTS RESERVED

            </td>

          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `
        });

        res.status(200).json({ message: 'If an account exists with this email, a password reset link has been sent.' });

    } catch (error) {
        console.error('Error in requestPasswordReset:', error);
        res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
    }
};

// Reset Password (Update in DB)
exports.resetPassword = async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    try {
        // Verify Password Reset Token
        // This token was generated from the email address (not a login session)
        // It contains the email address that was used to request the reset
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email;

        // Find User in Any Model
        const userData = await findUserByEmail(email);
        if (!userData) {
            return res.status(404).json({ error: 'Invalid token or user not found' });
        }

        const { model, user } = userData;

        // Hash New Password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update Password in DB
        if (model === AdminLogin) {
            await AdminLogin.findByIdAndUpdate(user._id, { password: hashedPassword });
        } else if (model === Agency) {
            await Agency.findByIdAndUpdate(user._id, { 
                choose_password: hashedPassword, 
                confirm_password: hashedPassword 
            });
        } else if (model === Volunteer) {
            await Volunteer.findByIdAndUpdate(user._id, { 
                choose_password: hashedPassword, 
                repeat_password: hashedPassword 
            });
        }

        res.status(200).json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Error in resetPassword:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: 'Invalid token' });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ error: 'Token has expired. Please request a new password reset link.' });
        }
        
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
};
