const Admin = require('../../models/Admin');

// Get all invited emails and their statuses
exports.getAllInvites = async (req, res) => {
    try {
        const invites = await Admin.find({}, 'invited_email status'); // Fetch only invited_email & status
        res.status(200).json({ success: true, data: invites });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
