const express = require('express');
const router = express.Router();

// Import routes with correct filenames
const authRoutes = require('./auth');
const campaignRoutes = require('./campaigns');
const whatsappRoutes = require('./whatsapp');

// Use routes
router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/whatsapp', whatsappRoutes);

module.exports = router; 