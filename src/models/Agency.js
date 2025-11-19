const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema({
    organization_name: { type: String },
    contact_person_name: { type: String },
    contact_email: { type: String, required: true, unique: true },
    contact_phone: { type: Number },
    choose_password: { type: String },
    confirm_password: { type: String },
    shipping_address: { type: String },
    suite: { type: String },
    state: { type: String },
    zip_code: { type: String },
    amazon_private: { type: String },
    amazon_public: { type: String },
    geocoded_address: { type: String },
    location: {
        type: {
            type: String,
            enum: ["Point"],
        },
        coordinates: {
            type: [Number],
            validate: {
                validator(value) {
                    return !value || value.length === 2;
                },
                message: "Location coordinates must contain [longitude, latitude]"
            }
        },
    },
    status: { type: String, enum: ["pending", "review", "active", "paused"], default: "pending" },
}, { timestamps: true });

agencySchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Agency", agencySchema);
