const Volunteer = require('../../models/Volunteer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.loginVolunteer = async (req, res) => {
    try {
        const { contact_email, choose_password } = req.body;

        // Check if email is already registered as a volunteer
        const existingVolunteer = await Volunteer.findOne({ contact_email });
        if (!existingVolunteer) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(choose_password, existingVolunteer.choose_password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: existingVolunteer._id, email: existingVolunteer.contact_email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Send response with ID included
        res.status(200).json({
            message: "Login successful",
            token,
            id: existingVolunteer._id
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
