require("dotenv").config();
const mongoose = require("mongoose");

console.log("🔍 MONGO_URI:", process.env.MONGO_URI); // Debugging

const MONGO_URI = process.env.MONGO_URI;

// Helper to check if MongoDB is currently connected
const isDBConnected = () => mongoose.connection.readyState === 1;

// Express middleware to prevent any DB usage when Mongo is not connected
const ensureDBConnectedMiddleware = (req, res, next) => {
  if (!isDBConnected()) {
    return res.status(503).json({
      message: "Database not connected. Please try again later.",
    });
  }
  next();
};

const connectDB = async () => {
  if (!MONGO_URI) {
    console.error("❌ MongoDB URI is missing. Check your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

// Attach helpers so they can be used where connectDB is imported
connectDB.isDBConnected = isDBConnected;
connectDB.ensureDBConnectedMiddleware = ensureDBConnectedMiddleware;

module.exports = connectDB;
