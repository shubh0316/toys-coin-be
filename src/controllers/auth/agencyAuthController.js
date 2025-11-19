const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For generating JWT tokens
const Agency = require('../../models/Agency'); // Import the model
const Volunteer = require('../../models/Volunteer');
// Login an agency
exports.loginAgency = async (req, res) => {
    try {
        const { contact_email, choose_password } = req.body;

        const existingVolunteer = await Volunteer.findOne({ contact_email });
        if(existingVolunteer) {
            return res.json(400).json({ message: "Email is already registered as an agency" })
        }
        // Find agency by email
        const agency = await Agency.findOne({ contact_email });
        if (!agency) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(choose_password, agency.choose_password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: agency._id, email: agency.contact_email },
            process.env.JWT_SECRET, // Use environment variable for security
            { expiresIn: "1h" }
        );

        res.status(200).json({ message: "Login successful", token });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
