const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/caresync';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000 // fail fast if no server is listening
    });
    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`\n❌ [MongoDB Connection Error]: ${error.message}`);
    console.warn(`
👉 Note: If you do not have a local MongoDB daemon running, you can:
   1. Install & start MongoDB locally: 'net start MongoDB' or run 'mongod'
   2. OR use a free cloud database from MongoDB Atlas (https://www.mongodb.com/atlas)
      and paste your connection string into your .env file:
      MONGO_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/caresync
\n`);
    // Allow server to run even if Mongo is down temporarily, but operations will fail gracefully
    return null;
  }
};

module.exports = connectDB;
