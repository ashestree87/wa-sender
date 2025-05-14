const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const auth = require('../middleware/auth');

const router = express.Router();

// Define routes
router.post('/initialize', auth, whatsappController.initializeSession);
router.get('/status', auth, whatsappController.getStatus);
router.post('/logout', auth, whatsappController.logout);
router.post('/send-test', auth, whatsappController.sendTestMessage);
router.post('/connections', auth, whatsappController.createConnection);
router.delete('/connections/:connectionId', auth, whatsappController.deleteConnection);
router.get('/connections/:connectionId/debug', auth, whatsappController.debugClientState);

// Reset connection status route
router.post('/connections/:connectionId/reset', auth, whatsappController.resetConnectionStatus);

module.exports = router; 