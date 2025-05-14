const Campaign = require('../../models/Campaign');
const Recipient = require('../../models/Recipient');
const campaignProcessor = require('../../services/campaign/processor');
const whatsappService = require('../../services/automation/whatsappService');

// Execute a campaign
exports.executeCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { connectionId } = req.body;
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if WhatsApp is connected
    const whatsappStatus = await whatsappService.getConnectionStatus(req.userId, connectionId);
    if (!whatsappStatus.authenticated) {
      return res.status(400).json({ 
        message: 'WhatsApp is not connected. Please set up WhatsApp before executing the campaign.'
      });
    }
    
    // Get campaign recipients
    const recipients = await Recipient.findByCampaignId(id);
    
    if (recipients.length === 0) {
      return res.status(400).json({ message: 'Campaign has no recipients' });
    }
    
    // Filter recipients that haven't been processed yet
    const pendingRecipients = recipients.filter(r => 
      r.status !== 'delivered' && r.status !== 'failed'
    );
    
    if (pendingRecipients.length === 0) {
      return res.status(400).json({ message: 'All recipients have been processed' });
    }
    
    // Update campaign status to in_progress
    const updatedCampaign = await Campaign.update(id, { status: 'in_progress' });
    
    // Process the campaign in the background
    process.nextTick(() => {
      campaignProcessor.processCampaign(updatedCampaign, pendingRecipients, req.userId)
        .catch(err => console.error(`Error processing campaign ${id}:`, err));
    });
    
    res.json({ 
      message: 'Campaign execution started',
      campaign: updatedCampaign,
      recipientCount: pendingRecipients.length
    });
  } catch (error) {
    console.error('Execute campaign error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Pause a campaign
exports.pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update campaign status to paused
    const updatedCampaign = await Campaign.update(id, { status: 'paused' });
    
    res.json({ 
      message: 'Campaign paused successfully',
      campaign: updatedCampaign
    });
  } catch (error) {
    console.error('Pause campaign error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Resume a paused campaign
exports.resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { connectionId } = req.body;
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (campaign.status !== 'paused') {
      return res.status(400).json({ message: 'Only paused campaigns can be resumed' });
    }
    
    // Check if WhatsApp is connected
    const whatsappStatus = await whatsappService.getConnectionStatus(req.userId, connectionId);
    if (!whatsappStatus.authenticated) {
      return res.status(400).json({ 
        message: 'WhatsApp is not connected. Please set up WhatsApp before resuming the campaign.'
      });
    }
    
    // Get campaign recipients that haven't been processed yet
    const recipients = await Recipient.findByCampaignId(id);
    const pendingRecipients = recipients.filter(r => 
      r.status !== 'delivered' && r.status !== 'failed'
    );
    
    if (pendingRecipients.length === 0) {
      // If all recipients have been processed, mark campaign as completed
      const completedCampaign = await Campaign.update(id, { status: 'completed' });
      return res.json({ 
        message: 'All recipients have been processed. Campaign marked as completed.',
        campaign: completedCampaign
      });
    }
    
    // Update campaign status to in_progress
    const updatedCampaign = await Campaign.update(id, { status: 'in_progress' });
    
    // Process the campaign in the background
    process.nextTick(() => {
      campaignProcessor.processCampaign(updatedCampaign, pendingRecipients, req.userId)
        .catch(err => console.error(`Error processing campaign ${id}:`, err));
    });
    
    res.json({ 
      message: 'Campaign resumed successfully',
      campaign: updatedCampaign,
      recipientCount: pendingRecipients.length
    });
  } catch (error) {
    console.error('Resume campaign error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Resend to a specific recipient
exports.resendToRecipient = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    const { connectionId } = req.body;
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if WhatsApp is connected
    const whatsappStatus = await whatsappService.getConnectionStatus(req.userId, connectionId);
    if (!whatsappStatus.authenticated) {
      return res.status(400).json({ 
        message: 'WhatsApp is not connected'
      });
    }
    
    // Get the recipient
    const recipient = await Recipient.findById(recipientId);
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    // Reset recipient status
    await Recipient.update(recipientId, { 
      status: 'pending',
      failure_reason: null
    });
    
    // Process the recipient in the background
    process.nextTick(() => {
      campaignProcessor.processRecipient(recipient, campaign, req.userId)
        .catch(err => console.error(`Error processing recipient ${recipientId}:`, err));
    });
    
    res.json({ 
      message: 'Resending message to recipient',
      recipient
    });
  } catch (error) {
    console.error('Resend to recipient error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Resend to all failed recipients
exports.resendToFailed = async (req, res) => {
  try {
    const { id } = req.params;
    const { connectionId } = req.body;
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if WhatsApp is connected
    const whatsappStatus = await whatsappService.getConnectionStatus(req.userId, connectionId);
    if (!whatsappStatus.authenticated) {
      return res.status(400).json({ 
        message: 'WhatsApp is not connected'
      });
    }
    
    // Get failed recipients
    const recipients = await Recipient.findByCampaignId(id);
    const failedRecipients = recipients.filter(r => r.status === 'failed');
    
    if (failedRecipients.length === 0) {
      return res.status(400).json({ message: 'No failed recipients to resend' });
    }
    
    // Update campaign status to in_progress if not already
    if (campaign.status !== 'in_progress') {
      await Campaign.update(id, { status: 'in_progress' });
    }
    
    // Process the failed recipients in the background
    process.nextTick(() => {
      campaignProcessor.processFailedRecipients(campaign, failedRecipients, req.userId)
        .catch(err => console.error(`Error processing failed recipients for campaign ${id}:`, err));
    });
    
    res.json({ 
      message: 'Resending messages to failed recipients',
      recipientCount: failedRecipients.length
    });
  } catch (error) {
    console.error('Resend to failed recipients error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add an alias for resendToFailed function
exports.resendFailedMessages = exports.resendToFailed; 