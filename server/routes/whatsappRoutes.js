const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const { auth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Add this new route
router.post('/connections/:connectionId/reset', auth, whatsappController.resetConnectionStatus);

module.exports = router; 