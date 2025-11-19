const Admin = require('../../models/Admin');
const Agency = require('../../models/Agency');
const { sendMail } = require('../../utils/mailer');

// Function to send invite and update status
exports.sendInvite = async (req, res) => {
    const { invited_email } = req.body;

    if (!invited_email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Check if the invited email already exists in the Agency model
        const existingAgency = await Agency.findOne({ contact_email: invited_email });

        // Determine the initial status
        const status = existingAgency ? 'completed' : 'pending';

        // Save admin record
        const newAdmin = new Admin({ invited_email, status });
        await newAdmin.save();

        // Send email only if not already completed
        if (status === 'pending') {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const logoUrl = process.env.LOGO_URL || `${frontendUrl}/logo.png`;
            const registerLink = `${frontendUrl}/register`;
            
            await sendMail({
                to: invited_email,
                subject: 'Admin Invitation - Foster Toys',
                text: `Hello there,\n\nYou have been invited to join Foster Toys as an administrator. Please click the link below to register:\n\n${registerLink}\n\nThank you,\nThe Foster Toys Team`,
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Invitation</title>
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
                You have been invited to join Foster Toys as an administrator. 
                Please click the button below to complete your registration:
              </p>

              <!-- REGISTER BUTTON (shadcn button style) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${registerLink}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 16px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                      Register Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin-top: 20px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="word-break: break-all; color:#666; font-size:14px; background-color:#fff; padding:10px; border-radius:8px;">
                ${registerLink}
              </p>

              <p style="margin-top: 30px;">Thank you,<br>
              The Foster Toys Team</p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px 30px; color:#555; font-size:12px; line-height:18px;">
              
              <strong>FOSTER TOYS, INC.</strong><br>
              1100 11TH STREET, SACRAMENTO CA. 95814<br><br>

              Foster Toys, Inc. is a 501(c)3 tax-exempt<br>
              nonprofit charity organization<br>
              Tax ID 39-3621457<br><br>

              ©2025 Foster Toys, Inc. All rights reserved

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
        }

        res.status(200).json({ message: `Invitation sent successfully. Status: ${status}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
