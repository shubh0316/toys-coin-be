const Agency = require('../models/Agency'); // Import the model

// Get all agencies
exports.getAllAgencies = async (req, res) => {
    try {
        const agencies = await Agency.find(); // Fetch all agencies
        res.status(200).json(agencies);
    } catch (error) {
        console.error("Error fetching agencies:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
