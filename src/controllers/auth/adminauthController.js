const AdminLogin = require('../../models/AdminLogin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Simple helper to introduce an artificial delay before DB operations
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hardcoded Admin Credentials
const hardcodedAdmins = [
  { email: 'cory.kelly@fostertoys.org', password: 'FosterToys2025911' },
  { email: 'aiden.kelly@fostertoys.org', password: 'FosterToys2025911' },
  { email: 'support@fostertoys.org', password: 'FosterToys2025911' },
];

// Function to seed hardcoded admins into the database
// NOTE: This should be called only AFTER a successful MongoDB connection
const seedAdmins = async () => {

  try {
    for (const admin of hardcodedAdmins) {
      // Artificial delay before querying the database
      await delay(500);
      const existingAdmin = await AdminLogin.findOne({ email: admin.email });

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        await AdminLogin.create({ email: admin.email, password: hashedPassword });
        console.log(`Added admin: ${admin.email}`);
      }
    }
  } catch (err) {
    console.error('Error seeding admin users:', err.message);
  }
};

// Expose seeding function so it can be called after DB connection
exports.seedAdmins = seedAdmins;

// Admin Login Function
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Check if the email exists in the database
    // Artificial delay before querying the database
    await delay(500);
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
