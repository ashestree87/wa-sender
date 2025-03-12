const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Define routes
router.post('/initialize', whatsappController.initializeSession);
router.get('/status', whatsappController.getSessionStatus);
router.post('/logout', whatsappController.logout);
router.post('/send-test', whatsappController.sendTestMessage);

module.exports = router; 