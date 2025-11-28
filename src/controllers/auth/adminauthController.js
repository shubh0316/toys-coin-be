const AdminLogin = require('../../models/AdminLogin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Hardcoded Admin Credentials
const hardcodedAdmins = [
    { email: 'cory.kelly@fostertoys.org', password: 'FosterToys2025911' },
    { email: 'aiden.kelly@fostertoys.org', password: 'FosterToys2025911' },
    { email: 'support@fostertoys.org', password: 'FosterToys2025911' }
];

// Function to seed hardcoded admins into the database
const seedAdmins = async () => {
    for (const admin of hardcodedAdmins) {
        const existingAdmin = await AdminLogin.findOne({ email: admin.email });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(admin.password, 10);
            await AdminLogin.create({ email: admin.email, password: hashedPassword });
            console.log(`Added admin: ${admin.email}`);
        }
    }
};

// Admin Login Function
exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Check if the email exists in the database
        const admin = await AdminLogin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT Token
        const token = jwt.sign({ email: admin.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('x-auth-tk', token, {
            httpOnly: true, // ✅ Prevents JavaScript access (XSS protection)
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // ✅ Cross-origin support in production
            secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
            path: '/',
        });
        res.status(200).json({ message: 'Login successful', token });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Call the seed function when the server starts
seedAdmins();
