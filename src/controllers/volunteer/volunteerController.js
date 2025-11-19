const Volunteer = require('../../models/Volunteer'); // Import the model
const bcrypt = require('bcryptjs'); // For hashing passwords
const jwt = require('jsonwebtoken'); // For generating JWT tokens
const { sendMail } = require('../../utils/mailer'); // Nodemailer wrapper for emails

// Register a new Volunteer
exports.registerVolunteer = async (req, res) => {
    try {
        const { 
            contact_person_name, contact_email, contact_phone, 
            choose_password, repeat_password, zip_code 
        } = req.body;

        // Check if passwords match
        if (choose_password !== repeat_password) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Check if the email already exists
        const existingVolunteer = await Volunteer.findOne({ contact_email });
        if (existingVolunteer) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(choose_password, 10);

        // Create a new Volunteer
        const newVolunteer = new Volunteer({
            contact_person_name,
            contact_email,
            contact_phone,
            choose_password: hashedPassword, // Store hashed password
            repeat_password: hashedPassword, // Store hashed for confirmation
            zip_code
        });
        await newVolunteer.save();
        
        // Send a welcome email (non-blocking - don't fail registration if email fails)
        let emailSent = false;
        let emailError = null;
        
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const logoUrl = process.env.LOGO_URL || `${frontendUrl}/logo.png`;
            
            await sendMail({
                to: contact_email, // Recipient email
                subject: 'Welcome to Foster Toys!',
                text: `Hello ${contact_person_name},\n\nThank you for registering as a volunteer with Foster Toys. We're excited to have you on board and appreciate your willingness to help make a difference in children's lives!\n\nThank you,\nThe Foster Toys Team`,
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Foster Toys</title>
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
              
              <p>Hello ${contact_person_name},</p>

              <p>
                Thank you for registering as a volunteer with Foster Toys! We're excited to have you on board 
                and appreciate your willingness to help make a difference in children's lives.
              </p>

              <p>
                Volunteers can help in many ways, from wrapping presents for holidays to helping organize events. 
                If your help is needed, you will be contacted directly by the agency partner or Foster Toys.
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
            emailSent = true;
        } catch (error) {
            emailError = error.message;
            console.error("Error sending welcome email to volunteer:", {
                email: contact_email,
                error: error.message,
                code: error.code,
            });
        }

        const responseMessage = emailSent 
            ? "Volunteer registered successfully! A confirmation email has been sent."
            : "Volunteer registered successfully! (Note: Confirmation email could not be sent, but your registration is complete.)";

        res.status(201).json({ 
            message: responseMessage,
            emailSent,
            ...(emailError && { emailError: "Email service temporarily unavailable" })
        });

    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};



