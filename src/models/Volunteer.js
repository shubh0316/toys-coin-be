const mongoose = require('mongoose');

const VolunteerSchema = new mongoose.Schema({
    contact_person_name: { type: String, required: false},
    contact_email: { type: String, required: false },
    contact_phone: { type: Number, required: false },
    choose_password: { type: String, required: false},
    repeat_password: { type: String, required: false},
    zip_code: { type: String, required: false},
})

module.exports = mongoose.model('Volunteer', VolunteerSchema);
