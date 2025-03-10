const Campaign = require('../models/Campaign');
const Recipient = require('../models/Recipient');
const schedulerService = require('../services/scheduler/schedulerService');

// Create a new campaign
exports.createCampaign = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      messageTemplate, 
      useAI, 
      aiPrompt,
      scheduledStartTime,
      scheduledEndTime
    } = req.body;
    
    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      description,
      messageTemplate,
      useAI,
      aiPrompt,
      scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : null,
      scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null
    });
    
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all campaigns for a user
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.findByUserId(req.userId);
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single campaign
exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a campaign
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const updatedCampaign = await Campaign.update(req.params.id, req.body);
    
    if (updatedCampaign.status === 'scheduled' && updatedCampaign.scheduled_start_time) {
      schedulerService.scheduleCampaign(updatedCampaign);
    }
    
    res.json(updatedCampaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await Campaign.delete(req.params.id);
    
    res.json({ message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add recipients to a campaign
exports.addRecipients = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const recipients = await Recipient.bulkCreate(
      req.body.recipients.map(r => ({
        ...r,
        campaignId: req.params.id
      }))
    );
    
    res.status(201).json(recipients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get recipients for a campaign
exports.getRecipients = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const recipients = await Recipient.findByCampaignId(req.params.id);
    
    res.json(recipients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update campaign status to completed
exports.completeCampaign = async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    const campaign = await Campaign.findByPk(campaignId);
    
    // Check if campaign exists
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if user owns the campaign
    if (campaign.user.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update campaign status
    await Campaign.update(
      { status: 'completed' },
      { where: { id: campaignId } }
    );
    
    res.json({ message: 'Campaign completed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Execute a campaign
exports.executeCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get campaign details
    const campaign = await Campaign.findById(id, req.userId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Get recipients
    const recipients = await Recipient.findByCampaignId(id);
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ message: 'No recipients found for this campaign' });
    }
    
    // Initialize WhatsApp
    const whatsappService = require('../services/automation/whatsappService');
    const isInitialized = await whatsappService.initialize(req.userId);
    
    if (!isInitialized) {
      return res.status(400).json({ message: 'WhatsApp not initialized. Please scan QR code first.' });
    }
    
    // Update campaign status
    await Campaign.updateStatus(id, 'in_progress');
    
    // Start sending messages
    res.json({ 
      message: 'Campaign execution started', 
      recipientCount: recipients.length 
    });
    
    // Process messages in background
    processCampaign(campaign, recipients, req.userId);
    
  } catch (error) {
    console.error('Execute campaign error:', error);
    res.status(500).json({ message: 'Failed to execute campaign', error: error.message });
  }
};

// Helper function to process campaign in background
async function processCampaign(campaign, recipients, userId) {
  const whatsappService = require('../services/automation/whatsappService');
  const aiService = require('../services/ai/openaiService');
  
  try {
    console.log(`Starting campaign execution: ${campaign.name}`);
    
    for (const recipient of recipients) {
      try {
        // Skip already processed recipients
        if (recipient.status !== 'pending') {
          console.log(`Skipping recipient ${recipient.name}: status is ${recipient.status}`);
          continue;
        }
        
        // Update recipient status to processing
        await Recipient.updateStatus(recipient.id, 'processing');
        
        // Prepare message
        let finalMessage = campaign.message_template;
        
        // Replace placeholders
        finalMessage = finalMessage.replace(/{name}/g, recipient.name);
        
        // Apply AI enhancement if enabled
        if (campaign.use_ai && campaign.ai_prompt) {
          try {
            const enhancedMessage = await aiService.enhanceMessage(
              finalMessage, 
              campaign.ai_prompt,
              recipient.name
            );
            finalMessage = enhancedMessage || finalMessage;
          } catch (aiError) {
            console.error('AI enhancement error:', aiError);
            // Continue with original message if AI fails
          }
        }
        
        // Save the final message
        await Recipient.updateMessage(recipient.id, finalMessage);
        
        // Send the message
        const result = await whatsappService.sendMessage(
          recipient.phone_number, 
          finalMessage
        );
        
        if (result.success) {
          await Recipient.updateStatus(recipient.id, 'sent', new Date());
          console.log(`Message sent to ${recipient.name} (${recipient.phone_number})`);
        } else {
          await Recipient.updateStatus(
            recipient.id, 
            'failed', 
            null, 
            result.error
          );
          console.error(`Failed to send message to ${recipient.name}:`, result.error);
        }
        
        // Add a delay between messages to avoid spam detection
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        
      } catch (recipientError) {
        console.error(`Error processing recipient ${recipient.name}:`, recipientError);
        await Recipient.updateStatus(
          recipient.id, 
          'failed', 
          null, 
          recipientError.message
        );
      }
    }
    
    // Update campaign status to completed
    await Campaign.updateStatus(campaign.id, 'completed');
    console.log(`Campaign execution completed: ${campaign.name}`);
    
  } catch (error) {
    console.error('Campaign processing error:', error);
    await Campaign.updateStatus(campaign.id, 'failed');
  }
} 