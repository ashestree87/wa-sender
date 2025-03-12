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

// Get all campaigns for the authenticated user
exports.getCampaigns = async (req, res) => {
  try {
    console.log('Getting campaigns for user:', req.userId);
    const campaigns = await Campaign.findByUserId(req.userId);
    console.log(`Found ${campaigns.length} campaigns`);
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
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
    
    // If campaign is in progress, pause it first
    if (campaign.status === 'in_progress') {
      try {
        await Campaign.update(id, { status: 'paused' });
        // Give a moment for any in-flight processes to recognize the pause
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (pauseError) {
        console.error('Error pausing campaign before deletion:', pauseError);
        // Continue with deletion even if pause fails
      }
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

// Skip a recipient - simplified version
exports.skipRecipient = async (req, res) => {
  try {
    const { campaignId, recipientId } = req.params;
    
    // Check if campaign exists and user is authorized
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if recipient exists
    const recipient = await Recipient.findById(recipientId);
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    // Simply update the status to 'skipped'
    await Recipient.updateStatus(recipientId, 'skipped');
    
    res.json({ message: 'Recipient skipped successfully' });
    
  } catch (error) {
    console.error('Skip recipient error:', error);
    res.status(500).json({ message: 'Failed to skip recipient', error: error.message });
  }
};

// Helper function to process campaign in background
async function processCampaign(campaign, recipients, userId) {
  try {
    // First check if campaign still exists
    const campaignStillExists = await Campaign.findById(campaign.id);
    if (!campaignStillExists) {
      console.log(`Campaign ${campaign.id} no longer exists, skipping processing`);
      return; // Exit early if campaign doesn't exist
    }
    
    // Initialize WhatsApp service
    const whatsappService = require('../services/automation/whatsappService');
    const aiService = require('../services/ai/messageGenerationService');
    
    // Initialize WhatsApp
    try {
      await whatsappService.initialize(userId);
    } catch (initError) {
      console.error('Error initializing WhatsApp:', initError);
      
      // Try to update campaign status if it still exists
      try {
        const stillExists = await Campaign.findById(campaign.id);
        if (stillExists) {
          await Campaign.updateStatus(campaign.id, 'paused');
        }
      } catch (updateError) {
        console.error('Error updating campaign status after init failure:', updateError);
      }
      return;
    }
    
    // Process each recipient
    for (const recipient of recipients) {
      // Check if campaign is still active before processing each recipient
      try {
        const currentCampaign = await Campaign.findById(campaign.id);
        if (!currentCampaign) {
          console.log(`Campaign ${campaign.id} no longer exists, stopping processing`);
          return;
        }
        
        if (currentCampaign.status !== 'in_progress') {
          console.log(`Campaign ${campaign.id} is no longer in progress (status: ${currentCampaign.status}), stopping processing`);
          return;
        }
        
        // Check if recipient still exists
        const recipientExists = await Recipient.findById(recipient.id);
        if (!recipientExists) {
          console.log(`Recipient ${recipient.id} no longer exists, skipping`);
          continue;
        }
        
        try {
          // Update recipient status to processing
          try {
            await Recipient.updateStatus(recipient.id, 'processing');
          } catch (statusError) {
            console.error(`Error updating recipient ${recipient.id} status to processing:`, statusError);
            // Continue anyway
          }
          
          // Generate message content
          let messageContent;
          if (campaign.use_ai) {
            try {
              messageContent = await aiService.generateMessage(
                campaign.message_template,
                campaign.ai_prompt,
                recipient.name
              );
            } catch (aiError) {
              console.error('Error generating AI message:', aiError);
              // Fallback to template
              messageContent = campaign.message_template.replace('{name}', recipient.name || 'there');
            }
          } else {
            // Use template with basic name replacement
            messageContent = campaign.message_template.replace('{name}', recipient.name || 'there');
          }
          
          // Store the generated message
          try {
            await Recipient.updateStatus(recipient.id, 'processing', null, null, messageContent);
          } catch (updateError) {
            console.error(`Error storing message for recipient ${recipient.id}:`, updateError);
            // Continue anyway
          }
          
          // Send the message
          let result;
          try {
            result = await whatsappService.sendMessage(recipient.phone_number, messageContent);
          } catch (sendError) {
            console.error(`Error sending message to ${recipient.phone_number}:`, sendError);
            
            // Try to update recipient status
            try {
              await Recipient.updateStatus(recipient.id, 'failed', null, sendError.message);
            } catch (updateError) {
              console.error(`Error updating recipient status after send failure:`, updateError);
            }
            
            // Skip to next recipient
            continue;
          }
          
          // Update recipient status based on result
          try {
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
          } catch (statusUpdateError) {
            console.error(`Error updating recipient status after send:`, statusUpdateError);
          }
          
          // Add a delay between messages to avoid spam detection
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
          
        } catch (recipientError) {
          console.error(`Error processing recipient ${recipient.name}:`, recipientError);
          
          // Try to update recipient status
          try {
            await Recipient.updateStatus(
              recipient.id, 
              'failed', 
              null, 
              recipientError.message
            );
          } catch (updateError) {
            console.error(`Error updating recipient status after processing error:`, updateError);
          }
        }
      } catch (checkError) {
        console.error(`Error checking campaign/recipient status:`, checkError);
        // Continue to next recipient
      }
    }
    
    // Check if campaign still exists before final update
    try {
      const finalCampaign = await Campaign.findById(campaign.id);
      if (!finalCampaign) {
        console.log(`Campaign ${campaign.id} no longer exists, skipping final status update`);
        return;
      }
      
      // Update campaign status to completed
      await Campaign.updateStatus(campaign.id, 'completed');
      console.log(`Campaign execution completed: ${campaign.name}`);
    } catch (finalUpdateError) {
      console.error(`Error in final campaign status update:`, finalUpdateError);
    }
    
  } catch (error) {
    console.error('Campaign processing error:', error);
    
    // Try to update campaign status if it still exists
    try {
      const stillExists = await Campaign.findById(campaign.id);
      if (stillExists) {
        await Campaign.updateStatus(campaign.id, 'failed');
      }
    } catch (updateError) {
      console.error('Error updating campaign status after processing error:', updateError);
    }
  } finally {
    // We intentionally don't close the WhatsApp browser to keep it open for future campaigns
    console.log('Campaign processing completed, keeping WhatsApp browser open for future use');
    
    // Just log any errors that occurred during processing
    if (this.processingErrors && this.processingErrors.length > 0) {
      console.error('Errors occurred during campaign processing:', this.processingErrors);
      this.processingErrors = [];
    }
  }
}

// Update the processFailedRecipients function to handle database connection issues
async function processFailedRecipients(campaign, recipients, userId) {
  try {
    // Initialize WhatsApp service
    const whatsappService = require('../services/automation/whatsappService');
    const aiService = require('../services/ai/messageGenerationService');
    
    // Process each recipient
    for (const recipient of recipients) {
      // Check if campaign still exists before processing each recipient
      try {
        const campaignStillExists = await Campaign.findById(campaign.id);
        if (!campaignStillExists) {
          console.log(`Campaign ${campaign.id} no longer exists, stopping processing`);
          return; // Exit early if campaign doesn't exist
        }
        
        // Check if recipient still exists
        const recipientStillExists = await Recipient.findById(recipient.id);
        if (!recipientStillExists) {
          console.log(`Recipient ${recipient.id} no longer exists, skipping`);
          continue; // Skip to next recipient
        }
        
        // Check if campaign status has changed to paused or something else
        if (campaignStillExists.status !== 'in_progress') {
          console.log(`Campaign ${campaign.id} is no longer in progress (status: ${campaignStillExists.status}), stopping processing`);
          return;
        }
        
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
            
            // Save the final message - wrap in try/catch
            try {
              await Recipient.updateStatus(recipient.id, 'processing', null, null, finalMessage);
            } catch (updateError) {
              console.error(`Error updating recipient message: ${updateError.message}`);
              // Continue even if update fails
            }
          }
          
          // Send the message
          const result = await whatsappService.sendMessage(
            recipient.phone_number, 
            finalMessage
          );
          
          // Update status based on result - wrap in try/catch
          try {
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
          } catch (statusUpdateError) {
            console.error(`Error updating recipient status: ${statusUpdateError.message}`);
            // Continue processing other recipients even if update fails
          }
          
          // Add a delay between messages to avoid spam detection
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
          
        } catch (recipientError) {
          console.error(`Error processing recipient ${recipient.name}:`, recipientError);
          
          // Wrap status update in try/catch
          try {
            await Recipient.updateStatus(
              recipient.id, 
              'failed', 
              { failure_reason: recipientError.message }
            );
          } catch (updateError) {
            console.error(`Error updating recipient failure status: ${updateError.message}`);
          }
        }
      } catch (checkError) {
        console.error(`Error checking campaign/recipient existence: ${checkError.message}`);
        // Continue to next recipient
      }
    }
    
    // Check if all recipients are processed - wrap in try/catch
    try {
      // Check if campaign still exists before final status update
      const campaignStillExists = await Campaign.findById(campaign.id);
      if (!campaignStillExists) {
        console.log(`Campaign ${campaign.id} no longer exists, skipping final status update`);
        return;
      }
      
      const allRecipients = await Recipient.findByCampaignId(campaign.id);
      const pendingRecipients = allRecipients.filter(r => ['pending', 'processing'].includes(r.status));
      
      if (pendingRecipients.length === 0) {
        // Update campaign status to completed if no pending recipients
        await Campaign.update(campaign.id, { status: 'completed' });
        console.log(`Campaign resend completed: ${campaign.name}`);
      }
    } catch (finalCheckError) {
      console.error(`Error in final campaign status check: ${finalCheckError.message}`);
    }
    
  } catch (error) {
    console.error('Failed recipients processing error:', error);
    // Don't throw - this is a background process
  }
}

// Helper function to process a single recipient
async function processSingleRecipient(campaign, recipient, userId) {
  try {
    // Check if campaign and recipient still exist
    const campaignExists = await Campaign.findById(campaign.id);
    if (!campaignExists) {
      console.log(`Campaign ${campaign.id} no longer exists, skipping recipient processing`);
      return;
    }
    
    const recipientExists = await Recipient.findById(recipient.id);
    if (!recipientExists) {
      console.log(`Recipient ${recipient.id} no longer exists, skipping processing`);
      return;
    }
    
    const whatsappService = require('../services/automation/whatsappService');
    const aiService = require('../services/ai/messageGenerationService');
    
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
      
      // Save the final message with error handling
      try {
        await Recipient.updateStatus(recipient.id, 'processing', null, null, finalMessage);
      } catch (updateError) {
        console.error(`Error updating recipient message: ${updateError.message}`);
        // Continue even if update fails
      }
    }
    
    // Send the message with error handling
    try {
      const result = await whatsappService.sendMessage(
        recipient.phone_number, 
        finalMessage
      );
      
      // Update status with error handling
      try {
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
      } catch (statusError) {
        console.error(`Error updating recipient status: ${statusError.message}`);
      }
    } catch (sendError) {
      console.error(`Error sending message to ${recipient.name}:`, sendError);
      
      // Try to update status
      try {
        await Recipient.updateStatus(
          recipient.id, 
          'failed', 
          { failure_reason: sendError.message }
        );
      } catch (updateError) {
        console.error(`Error updating recipient failure status: ${updateError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error processing recipient ${recipient?.name || 'unknown'}:`, error);
    
    // Try to update status if we have a recipient ID
    if (recipient && recipient.id) {
      try {
        await Recipient.updateStatus(
          recipient.id, 
          'failed', 
          { failure_reason: error.message }
        );
      } catch (updateError) {
        console.error(`Error updating recipient failure status: ${updateError.message}`);
      }
    }
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
    
    // Only allow pausing if campaign is in progress
    if (campaign.status !== 'in_progress') {
      return res.status(400).json({ 
        message: `Cannot pause campaign with status '${campaign.status}'` 
      });
    }
    
    // Update campaign status to paused
    await Campaign.updateStatus(id, 'paused');
    
    res.json({ message: 'Campaign paused successfully' });
    
  } catch (error) {
    console.error('Pause campaign error:', error);
    res.status(500).json({ message: 'Failed to pause campaign', error: error.message });
  }
};

// Resume a campaign
exports.resumeCampaign = async (req, res) => {
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
    
    // Only allow resuming if campaign is paused
    if (campaign.status !== 'paused') {
      return res.status(400).json({ 
        message: `Cannot resume campaign with status '${campaign.status}'` 
      });
    }
    
    // Update campaign status to in_progress
    await Campaign.updateStatus(id, 'in_progress');
    
    // Get pending recipients
    const pendingRecipients = await Recipient.findByCampaignId(id, 'pending');
    
    // If there are pending recipients, process them in the background
    if (pendingRecipients.length > 0) {
      processCampaign(campaign, pendingRecipients, req.userId);
    } else {
      // If no pending recipients, mark campaign as completed
      await Campaign.updateStatus(id, 'completed');
    }
    
    res.json({ 
      message: 'Campaign resumed successfully',
      pendingCount: pendingRecipients.length
    });
    
  } catch (error) {
    console.error('Resume campaign error:', error);
    res.status(500).json({ message: 'Failed to resume campaign', error: error.message });
  }
};

// Update the processRecipient function to handle deleted campaigns/recipients
async function processRecipient(recipient, campaign, userId) {
  try {
    // Check if campaign still exists before processing
    const campaignStillExists = await Campaign.findById(campaign.id);
    if (!campaignStillExists) {
      console.log(`Campaign ${campaign.id} no longer exists, skipping recipient ${recipient.id}`);
      return;
    }
    
    // Check if recipient still exists
    const recipientStillExists = await Recipient.findById(recipient.id);
    if (!recipientStillExists) {
      console.log(`Recipient ${recipient.id} no longer exists, skipping processing`);
      return;
    }
    
    // Rest of your existing recipient processing logic...
    
  } catch (error) {
    console.error(`Error processing recipient ${recipient.name}:`, error);
    
    try {
      // Check if recipient still exists before updating
      const recipientStillExists = await Recipient.findById(recipient.id);
      if (recipientStillExists) {
        await Recipient.updateStatus(
          recipient.id, 
          'failed', 
          { failure_reason: error.message }
        );
      } else {
        console.log(`Recipient ${recipient.id} was deleted during processing, skipping status update`);
      }
    } catch (updateError) {
      console.error(`Could not update recipient ${recipient.id} status:`, updateError);
      // Don't throw, just log
    }
  }
} 