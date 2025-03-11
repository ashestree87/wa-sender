const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const auth = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const supabase = require('../config/database');

// Apply auth middleware to all routes
router.use(auth);

// Add this at the top of your file to log all incoming requests
router.use((req, res, next) => {
  console.log(`Campaign route request: ${req.method} ${req.originalUrl}`);
  next();
});

// Create a new campaign
router.post('/', campaignController.createCampaign);

// Get all campaigns for a user
router.get('/', campaignController.getCampaigns);

// Get a single campaign
router.get('/:id', campaignController.getCampaign);

// Update a campaign
router.put('/:id', campaignController.updateCampaign);

// Delete a campaign
router.delete('/:id', campaignController.deleteCampaign);

// Add recipients to a campaign
router.post('/:id/recipients', campaignController.addRecipients);

// Get recipients for a campaign
router.get('/:id/recipients', campaignController.getRecipients);

// Add this route
router.post('/:id/execute', campaignController.executeCampaign);

// Add these routes for resending messages
router.post('/:id/resend-failed', campaignController.resendFailedMessages);
router.post('/:id/recipients/:recipientId/resend', campaignController.resendToRecipient);

// Add this route for duplicating a campaign
router.post('/:id/duplicate', campaignController.duplicateCampaign);

// Add this route handler for pausing a campaign
router.post('/:id/pause', campaignController.pauseCampaign);

// Also add the resume route if it's missing
router.post('/:id/resume', campaignController.resumeCampaign);

// Update the skip recipient route to use the Campaign model methods
router.post('/:id/recipients/:recipientId/skip', async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    console.log(`Attempting to skip recipient ${recipientId} for campaign ${id}`);
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      console.log(`Campaign ${id} not found`);
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Fix the authorization check - use req.userId
    if (String(campaign.user_id) !== String(req.userId)) {
      console.log(`User ${req.userId} not authorized for campaign ${id} (owned by ${campaign.user_id})`);
      return res.status(403).json({ message: 'Not authorized to modify this campaign' });
    }
    
    // Find the recipient
    console.log(`Finding recipient ${recipientId}`);
    const recipient = await Campaign.getRecipient(id, recipientId);
    
    if (!recipient) {
      console.log(`Recipient ${recipientId} not found`);
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    console.log(`Recipient found with status: ${recipient.status}`);
    
    // Update recipient status to skipped
    console.log(`Updating recipient ${recipientId} status to skipped`);
    await Campaign.updateRecipientStatus(id, recipientId, 'skipped');
    
    console.log(`Successfully skipped recipient ${recipientId}`);
    res.json({ message: 'Recipient skipped successfully' });
    
  } catch (error) {
    console.error('Skip recipient error:', error);
    res.status(500).json({ 
      message: 'Failed to skip recipient', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router; 