const express = require('express');
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Make sure all these routes are defined correctly
router.post('/:id/execute', authMiddleware, campaignController.executeCampaign);
router.post('/:id/duplicate', authMiddleware, campaignController.duplicateCampaign);
router.post('/:id/resend-failed', authMiddleware, campaignController.resendFailedMessages);
router.post('/:id/recipients/:recipientId/resend', authMiddleware, campaignController.resendToRecipient);
router.post('/:id/recipients/:recipientId/skip', authMiddleware, campaignController.skipRecipient);
router.post('/:id/pause', authMiddleware, campaignController.pauseCampaign);
router.post('/:id/resume', authMiddleware, campaignController.resumeCampaign);

router.get('/', authMiddleware, campaignController.getCampaigns);
router.post('/', authMiddleware, campaignController.createCampaign);
router.get('/:id', authMiddleware, campaignController.getCampaign);
router.put('/:id', authMiddleware, campaignController.updateCampaign);
router.delete('/:id', authMiddleware, campaignController.deleteCampaign);
router.get('/:id/recipients', authMiddleware, campaignController.getRecipients);
router.post('/:id/recipients', authMiddleware, campaignController.addRecipients);

module.exports = router; 