const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

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

module.exports = router; 