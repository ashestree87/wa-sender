const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

module.exports = app; 