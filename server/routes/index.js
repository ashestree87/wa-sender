const express = require('express');
const authRoutes = require('./authRoutes');
const campaignRoutes = require('./campaignRoutes');
const whatsappRoutes = require('./whatsappRoutes');

const router = express.Router();

// Mount the routes
router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/whatsapp', whatsappRoutes);

module.exports = router; 