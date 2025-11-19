const Agency = require('../models/Agency'); // Import the model

// Update an agency by ID
exports.updateAgencyById = async (req, res) => {
    try {
        const { id } = req.params; // Extract ID from request params
        const updates = req.body; // Extract update data from request body

        const updatedAgency = await Agency.findByIdAndUpdate(id, updates, { 
            new: true, // Return the updated document
            runValidators: true // Ensure validation rules are applied
        });

        if (!updatedAgency) {
            return res.status(404).json({ message: "Agency not found" });
        }

        res.status(200).json({ message: "Agency updated successfully", updatedAgency });
    } catch (error) {
        console.error("Error updating agency:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
