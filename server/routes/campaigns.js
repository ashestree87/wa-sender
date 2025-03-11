const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const auth = require('../middleware/auth');
const Campaign = require('../models/Campaign');

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
router.put('/:id/pause', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if user has permission to pause this campaign
    if (campaign.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to pause this campaign' });
    }
    
    campaign.status = 'paused';
    campaign.updatedAt = Date.now();
    
    await campaign.save();
    
    res.json({ message: 'Campaign paused successfully', campaign });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 