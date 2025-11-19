const Agency = require('../models/Agency'); // Import the model

// Get an agency by ID
exports.getAgencyById = async (req, res) => {
    try {
        const { id } = req.params; // Extract ID from request params
        const agency = await Agency.findById(id); // Find agency by ID

        if (!agency) {
            return res.status(404).json({ message: "Agency not found" });
        }

        res.status(200).json(agency);
    } catch (error) {
        console.error("Error fetching agency by ID:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
