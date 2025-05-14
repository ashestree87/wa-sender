const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

// Create Express app
const app = express();

// Configure CORS to handle multiple origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost', 
      'http://localhost:3000',
      'http://localhost:80'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === origin) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', routes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Server Error', error: err.message });
});

// Support for Cloudflare Workers
// This function adapts the Express app to work in a Cloudflare Worker
const adaptToWorker = async (request, env) => {
  return new Promise((resolve) => {
    // Use Express to handle the request
    app(request, undefined, resolve);
  });
};

// Export both the Express app and the Worker adapter
module.exports = process.env.CLOUDFLARE_WORKER 
  ? adaptToWorker 
  : app; 