const Volunteer = require('../../models/Volunteer'); // Import the model
const bcrypt = require('bcryptjs'); // For hashing passwords
const jwt = require('jsonwebtoken'); // For generating JWT tokens
const { sendMail } = require('../../utils/mailer'); // Nodemailer wrapper for emails

// Register a new Volunteer
exports.registerVolunteer = async (req, res) => {
    try {
        // Log the incoming request for debugging
        console.log('Register Volunteer Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Request Headers Content-Type:', req.headers['content-type']);
        console.log('Request Body Type:', typeof req.body);
        console.log('Request Body Keys:', req.body ? Object.keys(req.body) : 'req.body is null/undefined');
        
        // Check if request body exists
        if (!req.body || typeof req.body !== 'object') {
            console.log('Error: Request body is missing or invalid');
            return res.status(400).json({ message: "Request body is required" });
        }
        
        const { 
            contact_person_name, contact_email, contact_phone, 
            choose_password, repeat_password, zip_code 
        } = req.body;

        // Validate required fields
        console.log('Step 1: Validating contact_person_name...');
        if (!contact_person_name || !contact_person_name.trim()) {
            console.log('Validation failed: contact_person_name is missing or empty');
            return res.status(400).json({ message: "Contact person name is required" });
        }
        console.log('✓ contact_person_name validated');

        console.log('Step 2: Validating contact_email...');
        if (!contact_email || !contact_email.trim()) {
            console.log('Validation failed: contact_email is missing or empty');
            return res.status(400).json({ message: "Contact email is required" });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact_email)) {
            console.log('Validation failed: Invalid email format');
            return res.status(400).json({ message: "Invalid email format" });
        }
        // Normalize email to lowercase for consistent storage and lookup
        const normalizedEmail = contact_email.trim().toLowerCase();
        console.log('✓ contact_email validated and normalized');

        console.log('Step 3: Validating contact_phone...');
        if (!contact_phone || (typeof contact_phone === 'string' && !contact_phone.trim())) {
            console.log('Validation failed: contact_phone is missing or empty');
            return res.status(400).json({ message: "Contact phone is required" });
        }

        // Validate phone number format (should have at least 10 digits)
        const phoneDigits = String(contact_phone).replace(/\D/g, '');
        console.log('Phone number processing:', { original: contact_phone, digits: phoneDigits, length: phoneDigits.length });
        if (!phoneDigits || phoneDigits.length < 10) {
            console.log('Validation failed: phone number has less than 10 digits');
            return res.status(400).json({ message: "Contact phone must contain at least 10 digits" });
        }
        console.log('✓ contact_phone validated');

        console.log('Step 4: Validating passwords...');
        if (!choose_password) {
            console.log('Validation failed: choose_password is missing');
            return res.status(400).json({ message: "Password is required" });
        }

        if (choose_password.length < 6) {
            console.log('Validation failed: Password too short');
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        if (!repeat_password) {
            console.log('Validation failed: repeat_password is missing');
            return res.status(400).json({ message: "Password confirmation is required" });
        }

        // Check if passwords match
        if (choose_password !== repeat_password) {
            console.log('Validation failed: Passwords do not match');
            return res.status(400).json({ message: "Passwords do not match" });
        }
        console.log('✓ Passwords validated');

        console.log('Step 5: Validating zip_code...');
        if (!zip_code || !zip_code.trim()) {
            console.log('Validation failed: zip_code is missing or empty');
            return res.status(400).json({ message: "Zip code is required" });
        }
        console.log('✓ zip_code validated');

        // Check if the email already exists (using normalized email)
        console.log('Step 6: Checking if email already exists...');
        console.log('Checking for email:', normalizedEmail);
        const existingVolunteer = await Volunteer.findOne({ contact_email: normalizedEmail });
        if (existingVolunteer) {
            console.log('Validation failed: Email already exists in database');
            return res.status(400).json({ message: "Email already exists" });
        }
        console.log('✓ Email is unique');

        // Hash the password
        console.log('Step 7: Hashing password...');
        const hashedPassword = await bcrypt.hash(choose_password, 10);
        console.log('✓ Password hashed');

        // Convert contact_phone to number (extract digits only)
        console.log('Step 8: Parsing phone number...');
        // Use BigInt or keep as string if the number is too large for safe integer
        let phoneNumber;
        if (phoneDigits.length > 15) {
            console.log('Validation failed: phone number too long');
            return res.status(400).json({ message: "Phone number is too long" });
        }
        
        // For phone numbers, we can safely parse as integer
        phoneNumber = parseInt(phoneDigits, 10);
        console.log('Parsed phone number:', phoneNumber, 'Type:', typeof phoneNumber);
        
        if (isNaN(phoneNumber) || phoneNumber <= 0) {
            console.log('Validation failed: phone number is NaN or invalid', { phoneNumber, phoneDigits });
            return res.status(400).json({ message: "Invalid phone number format" });
        }
        
        console.log('✓ Phone number parsed successfully:', phoneNumber);

        // Create a new Volunteer
        console.log('Step 9: Creating volunteer object...');
        const newVolunteer = new Volunteer({
            contact_person_name: contact_person_name.trim(),
            contact_email: normalizedEmail, // Use normalized email
            contact_phone: phoneNumber,
            choose_password: hashedPassword, // Store hashed password
            repeat_password: hashedPassword, // Store hashed for confirmation
            zip_code: zip_code.trim()
        });
        console.log('✓ Volunteer object created');
        
        console.log('Step 10: Saving volunteer to database...');
        await newVolunteer.save();
        console.log('✓ Volunteer saved successfully');
        
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
        console.error("Error registering volunteer:", error);
        console.error("Error stack:", error.stack);
        console.error("Error name:", error.name);
        console.error("Error code:", error.code);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.log('Mongoose validation errors:', errors);
            return res.status(400).json({ 
                message: "Validation error", 
                errors: errors 
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            console.log('Duplicate key error - email already exists');
            return res.status(400).json({ 
                message: "Email already exists" 
            });
        }

        res.status(500).json({ 
            message: "Server error", 
            error: error.message 
        });
    }
};



