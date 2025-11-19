const Volunteer = require('../../models/Volunteer'); // Import the model

// Get an volunteer by ID
exports.getVolunteerById = async (req, res) => {
    try {
        const { id } = req.params; // Extract ID from request params
        const volunteer = await Volunteer.findById(id); // Find volunteer by ID

        if (!volunteer) {
            return res.status(404).json({ message: "Volunteer not found" });
        }

        res.status(200).json({ volunteer });
    } catch (error) {
        console.error("Error fetching volunteer by ID:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
