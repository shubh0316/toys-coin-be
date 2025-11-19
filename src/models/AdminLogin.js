const mongoose = require('mongoose');

const AdminLoginSchema = new mongoose.Schema({
    email: { type: String, required: false },
    password: { type: String, required: false},
})

module.exports = mongoose.model('AdminLogin', AdminLoginSchema);
