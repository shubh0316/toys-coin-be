const Volunteer = require('../../models/Volunteer'); // Import the model
const bcrypt = require('bcryptjs'); // For hashing passwords

// Update an Volunteer by ID
exports.updateVolunteerById = async (req, res) => {
    try {
        const { id } = req.params; // Extract ID from request params
        const { choose_password, repeat_password, ...otherUpdates } = req.body; // Extract update data from request body

        // If passwords are provided, validate and hash them
        if (choose_password || repeat_password) {
            // Check if both passwords are provided
            if (!choose_password || !repeat_password) {
                return res.status(400).json({ message: "Both password fields are required to update password" });
            }

            // Check if passwords match
            if (choose_password !== repeat_password) {
                return res.status(400).json({ message: "Passwords do not match" });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(choose_password, 10);
            otherUpdates.choose_password = hashedPassword;
            otherUpdates.repeat_password = hashedPassword;
        }

        const updatedVolunteer = await Volunteer.findByIdAndUpdate(id, otherUpdates, { 
            new: true, // Return the updated document
            runValidators: true // Ensure validation rules are applied
        });

        if (!updatedVolunteer) {
            return res.status(404).json({ message: "Volunteer not found" });
        }

        res.status(200).json({ message: "Volunteer updated successfully", volunteer: updatedVolunteer });
    } catch (error) {
        console.error("Error updating Volunteer:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
