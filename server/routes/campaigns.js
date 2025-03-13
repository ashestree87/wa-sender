const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Add this at the top of your file to log all incoming requests
router.use((req, res, next) => {
  console.log(`Campaign route request: ${req.method} ${req.originalUrl}`);
  next();
});

// Campaign routes
router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Campaign execution routes
router.post('/:id/execute', campaignController.executeCampaign);
router.post('/:id/pause', campaignController.pauseCampaign);
router.post('/:id/resume', campaignController.resumeCampaign);
router.post('/:id/duplicate', campaignController.duplicateCampaign);
router.post('/:id/resend-failed', campaignController.resendFailedMessages);

// Recipient routes
router.get('/:id/recipients', campaignController.getRecipients);
router.post('/:id/recipients', campaignController.addRecipients);
router.put('/:id/recipients/:recipientId', campaignController.updateRecipient);
router.delete('/:id/recipients/:recipientId', campaignController.deleteRecipient);
router.post('/:id/recipients/:recipientId/resend', campaignController.resendToRecipient);
router.post('/:id/recipients/:recipientId/skip', campaignController.skipRecipient);
router.post('/:id/recipients/:recipientId/reset', campaignController.resetRecipientStatus);

module.exports = router; 