const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    invited_email: { type: String, required: false },
    status: { type: String, required: false},
})

module.exports = mongoose.model('Admin', AdminSchema);
