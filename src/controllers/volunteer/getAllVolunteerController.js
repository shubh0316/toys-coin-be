const Volunteer = require('../../models/Volunteer'); // Import the model

// Get all volunteer
exports.getAllVolunteer = async (req, res) => {
    try {
        const volunteers = await Volunteer.find(); // Fetch all agencies
        res.status(200).json(volunteers);
    } catch (error) {
        console.error("Error fetching volunteer:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
