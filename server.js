const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const connectDB = require('./src/config/db');

const app = express();

// ✅ CORS Configuration - Allow all origins
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true, // Allow cookies & authentication headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Allow all necessary HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  exposedHeaders: ['Authorization'], // Allow frontend to access `Authorization` header
};

app.use(cors(corsOptions));

// ✅ Security & Logging Middleware
app.use(helmet({
  referrerPolicy: { policy: "no-referrer-when-downgrade" },
  crossOriginEmbedderPolicy: false, // Allow cross-origin requests
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Connect to MongoDB
connectDB()
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

// ✅ API Routes
const agencyRoutes = require('./src/routes/agencyRoutes');
const volunteerRoutes = require('./src/routes/volunteerRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const authRoutes = require('./src/routes/authRoutes');

app.use('/api/agencies', agencyRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

// ✅ Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Server is running! 🚀' });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      message: 'CORS Error: Origin not allowed',
      error: err.message 
    });
  }
  
  console.error('❌ Error:', err.stack);
  res.status(500).json({ message: 'An unexpected error occurred.', error: err.message });
});

// ✅ Start Express Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
