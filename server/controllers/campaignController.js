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
    const { id } = req.params;
    
    // First check if the campaign exists
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the user is authorized to delete this campaign
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this campaign' });
    }
    
    // Delete associated recipients first to avoid foreign key constraints
    await Recipient.deleteByCampaignId(id);
    
    // Then delete the campaign
    await Campaign.delete(id);
    
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Failed to delete campaign', error: error.message });
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
    await Campaign.update(id, { status: 'in_progress' });
    
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

// Resend messages to all failed recipients
exports.resendFailedMessages = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get campaign details
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check authorization
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get failed recipients
    const recipients = await Recipient.findByCampaignId(id);
    const failedRecipients = recipients.filter(r => r.status === 'failed');
    
    if (failedRecipients.length === 0) {
      return res.status(400).json({ message: 'No failed messages to resend' });
    }
    
    // Initialize WhatsApp
    const whatsappService = require('../services/automation/whatsappService');
    const isInitialized = await whatsappService.initialize(req.userId);
    
    if (!isInitialized) {
      return res.status(400).json({ message: 'WhatsApp not initialized. Please scan QR code first.' });
    }
    
    // Update campaign status if it's not already in progress
    if (campaign.status !== 'in_progress') {
      await Campaign.update(id, { status: 'in_progress' });
    }
    
    // Send response before processing
    res.json({ 
      message: 'Resending failed messages', 
      recipientCount: failedRecipients.length 
    });
    
    // Process messages in background
    processFailedRecipients(campaign, failedRecipients, req.userId);
    
  } catch (error) {
    console.error('Resend failed messages error:', error);
    res.status(500).json({ message: 'Failed to resend messages', error: error.message });
  }
};

// Resend message to a specific recipient
exports.resendToRecipient = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    
    // Get campaign details
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check authorization
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get recipient
    const recipient = await Recipient.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    if (recipient.campaign_id !== id) {
      return res.status(400).json({ message: 'Recipient does not belong to this campaign' });
    }
    
    // Initialize WhatsApp
    const whatsappService = require('../services/automation/whatsappService');
    const isInitialized = await whatsappService.initialize(req.userId);
    
    if (!isInitialized) {
      return res.status(400).json({ message: 'WhatsApp not initialized. Please scan QR code first.' });
    }
    
    // Update recipient status to pending
    await Recipient.updateStatus(recipientId, 'pending');
    
    // Send response before processing
    res.json({ 
      message: 'Resending message to recipient', 
      recipient: recipient.name 
    });
    
    // Process message in background
    processSingleRecipient(campaign, recipient, req.userId);
    
  } catch (error) {
    console.error('Resend to recipient error:', error);
    res.status(500).json({ message: 'Failed to resend message', error: error.message });
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
        await Recipient.updateStatus(recipient.id, 'processing', null, null, finalMessage);
        
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

// Helper function to process failed recipients in background
async function processFailedRecipients(campaign, recipients, userId) {
  const whatsappService = require('../services/automation/whatsappService');
  const aiService = require('../services/ai/openaiService');
  
  try {
    console.log(`Starting resend for failed messages in campaign: ${campaign.name}`);
    
    for (const recipient of recipients) {
      try {
        // Update recipient status to processing
        await Recipient.updateStatus(recipient.id, 'processing');
        
        // Prepare message
        let finalMessage = recipient.message || campaign.message_template;
        
        // Replace placeholders if using the template again
        if (!recipient.message) {
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
          await Recipient.updateStatus(recipient.id, 'processing', null, null, finalMessage);
        }
        
        // Send the message
        const result = await whatsappService.sendMessage(
          recipient.phone_number, 
          finalMessage
        );
        
        if (result.success) {
          await Recipient.updateStatus(recipient.id, 'sent', { sent_at: new Date() });
          console.log(`Message resent to ${recipient.name} (${recipient.phone_number})`);
        } else {
          await Recipient.updateStatus(
            recipient.id, 
            'failed', 
            { failure_reason: result.error }
          );
          console.error(`Failed to resend message to ${recipient.name}:`, result.error);
        }
        
        // Add a delay between messages to avoid spam detection
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        
      } catch (recipientError) {
        console.error(`Error processing recipient ${recipient.name}:`, recipientError);
        await Recipient.updateStatus(
          recipient.id, 
          'failed', 
          { failure_reason: recipientError.message }
        );
      }
    }
    
    // Check if all recipients are processed
    const allRecipients = await Recipient.findByCampaignId(campaign.id);
    const pendingRecipients = allRecipients.filter(r => ['pending', 'processing'].includes(r.status));
    
    if (pendingRecipients.length === 0) {
      // Update campaign status to completed if no pending recipients
      await Campaign.update(campaign.id, { status: 'completed' });
      console.log(`Campaign resend completed: ${campaign.name}`);
    }
    
  } catch (error) {
    console.error('Failed recipients processing error:', error);
  }
}

// Helper function to process a single recipient
async function processSingleRecipient(campaign, recipient, userId) {
  const whatsappService = require('../services/automation/whatsappService');
  const aiService = require('../services/ai/openaiService');
  
  try {
    console.log(`Starting resend for recipient: ${recipient.name}`);
    
    // Prepare message
    let finalMessage = recipient.message || campaign.message_template;
    
    // Replace placeholders if using the template again
    if (!recipient.message) {
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
      await Recipient.updateStatus(recipient.id, 'processing', null, null, finalMessage);
    }
    
    // Send the message
    const result = await whatsappService.sendMessage(
      recipient.phone_number, 
      finalMessage
    );
    
    if (result.success) {
      await Recipient.updateStatus(recipient.id, 'sent', { sent_at: new Date() });
      console.log(`Message resent to ${recipient.name} (${recipient.phone_number})`);
    } else {
      await Recipient.updateStatus(
        recipient.id, 
        'failed', 
        { failure_reason: result.error }
      );
      console.error(`Failed to resend message to ${recipient.name}:`, result.error);
    }
    
  } catch (error) {
    console.error(`Error processing recipient ${recipient.name}:`, error);
    await Recipient.updateStatus(
      recipient.id, 
      'failed', 
      { failure_reason: error.message }
    );
  }
}

// Duplicate a campaign
exports.duplicateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body; // Get custom name from request body
    
    // Find the original campaign
    const originalCampaign = await Campaign.findById(id);
    
    if (!originalCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (originalCampaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Create a new campaign with the same data but a new name
    const newCampaignData = {
      userId: req.userId,
      name: name || `${originalCampaign.name} (Copy)`, // Use provided name or default
      description: originalCampaign.description,
      messageTemplate: originalCampaign.message_template,
      useAI: originalCampaign.use_ai,
      aiPrompt: originalCampaign.ai_prompt,
      status: 'draft' // Always start as draft
    };
    
    const newCampaign = await Campaign.create(newCampaignData);
    
    // Find recipients from the original campaign
    const recipients = await Recipient.findByCampaignId(id);
    
    // Create recipients for the new campaign if there are any
    if (recipients && recipients.length > 0) {
      await Recipient.bulkCreate(
        recipients.map(r => ({
          campaignId: newCampaign.id,
          phoneNumber: r.phone_number,
          name: r.name
        }))
      );
    }
    
    res.status(201).json({ 
      message: 'Campaign duplicated successfully', 
      id: newCampaign.id 
    });
    
  } catch (error) {
    console.error('Duplicate campaign error:', error);
    res.status(500).json({ message: 'Failed to duplicate campaign', error: error.message });
  }
}; 