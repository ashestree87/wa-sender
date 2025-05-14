const Campaign = require('../../models/Campaign');
const Recipient = require('../../models/Recipient');
const whatsappService = require('../automation/whatsappService');
const timeWindowService = require('./time-window');
const supabase = require('../../config/database');

// Try to load the OpenAI module, but don't fail if it's missing
let openai;
try {
  openai = require('../ai/openai');
} catch (error) {
  console.warn('OpenAI module not found, AI message generation will be disabled');
  
  // Create a fallback implementation
  openai = {
    generateMessage: async (prompt, template, name, phoneNumber) => {
      console.log('[Fallback AI] Would have generated message with AI. Using template instead.');
      return template;
    }
  };
}

/**
 * Process all recipients for a campaign
 * @param {Object} campaign - Campaign object
 * @param {Array} recipients - Array of recipient objects 
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function processCampaign(campaign, recipients, userId) {
  console.log(`Starting to process campaign ${campaign.id} with ${recipients.length} recipients`);
  
  // Track daily limit
  let dailyCount = 0;
  const dailyLimit = campaign.daily_limit || 0;
  let lastSentDay = new Date().getDate();
  
  // Process each recipient in sequence
  for (const recipient of recipients) {
    // Check if campaign is still active
    const updatedCampaign = await Campaign.findById(campaign.id);
    if (!updatedCampaign || updatedCampaign.status !== 'in_progress') {
      console.log(`Campaign ${campaign.id} is no longer in progress, stopping execution`);
      break;
    }
    
    // Reset daily counter if it's a new day
    const currentDay = new Date().getDate();
    if (currentDay !== lastSentDay) {
      dailyCount = 0;
      lastSentDay = currentDay;
    }
    
    // Check if we've hit the daily limit
    if (dailyLimit > 0 && dailyCount >= dailyLimit) {
      console.log(`Daily limit of ${dailyLimit} reached for campaign ${campaign.id}, waiting until tomorrow`);
      
      // Wait until midnight plus 1 minute
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 1, 0, 0);
      
      const waitTime = tomorrow.getTime() - now.getTime();
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      dailyCount = 0;
      lastSentDay = tomorrow.getDate();
    }
    
    // Wait until within time window if specified
    try {
      const { time_window_start, time_window_end } = campaign;
      await timeWindowService.waitUntilTimeWindow(time_window_start, time_window_end);
      
      // Skip already processed recipients
      if (recipient.status === 'delivered' || recipient.status === 'failed') {
        continue;
      }
      
      // Process the recipient
      await processRecipient(recipient, campaign, userId);
      dailyCount++;
      
      // Random delay between messages to avoid detection
      const minDelay = campaign.min_delay_seconds || 3;
      const maxDelay = campaign.max_delay_seconds || 10;
      const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      console.log(`Waiting ${delaySeconds} seconds before next message`);
      
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    } catch (error) {
      console.error(`Error processing recipient ${recipient.id} for campaign ${campaign.id}:`, error);
      // Continue with next recipient
    }
  }
  
  // Check if all recipients have been processed
  const allRecipients = await Recipient.findByCampaignId(campaign.id);
  const pendingRecipients = allRecipients.filter(r => 
    r.status !== 'delivered' && r.status !== 'failed'
  );
  
  if (pendingRecipients.length === 0) {
    console.log(`All recipients processed for campaign ${campaign.id}, marking as completed`);
    await Campaign.update(campaign.id, { status: 'completed' });
  }
  
  console.log(`Finished processing campaign ${campaign.id}`);
}

/**
 * Process failed recipients for a campaign
 * @param {Object} campaign - Campaign object
 * @param {Array} recipients - Array of recipient objects
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function processFailedRecipients(campaign, recipients, userId) {
  console.log(`Reprocessing ${recipients.length} failed recipients for campaign ${campaign.id}`);
  
  // Process each recipient in sequence
  for (const recipient of recipients) {
    // Check if campaign is still active
    const updatedCampaign = await Campaign.findById(campaign.id);
    if (!updatedCampaign || updatedCampaign.status !== 'in_progress') {
      console.log(`Campaign ${campaign.id} is no longer in progress, stopping execution`);
      break;
    }
    
    try {
      // Reset recipient status
      await Recipient.update(recipient.id, { 
        status: 'pending',
        failure_reason: null
      });
      
      // Process the recipient
      await processRecipient(recipient, campaign, userId);
      
      // Random delay between messages
      const minDelay = campaign.min_delay_seconds || 3;
      const maxDelay = campaign.max_delay_seconds || 10;
      const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    } catch (error) {
      console.error(`Error reprocessing recipient ${recipient.id} for campaign ${campaign.id}:`, error);
      // Continue with next recipient
    }
  }
  
  console.log(`Finished reprocessing failed recipients for campaign ${campaign.id}`);
}

/**
 * Process a single recipient
 * @param {Object} recipient - Recipient object
 * @param {Object} campaign - Campaign object
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function processRecipient(recipient, campaign, userId) {
  try {
    console.log(`Processing recipient ${recipient.id} (${recipient.name})`);
    
    // Update recipient status to in_progress
    await Recipient.update(recipient.id, { status: 'in_progress' });
    
    // Get or prepare the message
    let message = recipient.message;
    
    // If no recipient-specific message, use the campaign template
    if (!message) {
      message = campaign.message_template;
      
      // Replace placeholders
      message = message.replace(/{name}/g, recipient.name || '');
      message = message.replace(/{phone}/g, recipient.phone_number || '');
      
      // Use AI to customize message if enabled
      if (campaign.use_ai && campaign.ai_prompt) {
        try {
          const customMessage = await openai.generateMessage(
            campaign.ai_prompt,
            message,
            recipient.name,
            recipient.phone_number
          );
          
          if (customMessage) {
            message = customMessage;
          }
        } catch (aiError) {
          console.error('AI message generation error:', aiError);
          // Continue with the template message if AI fails
        }
      }
      
      // Save the personalized message to the recipient
      await Recipient.update(recipient.id, { message });
    }
    
    // Check if the recipient has a WhatsApp number format
    const phoneNumber = formatPhoneNumber(recipient.phone_number);
    if (!phoneNumber) {
      throw new Error('Invalid phone number format');
    }
    
    // Send the message
    const result = await whatsappService.sendMessage(userId, phoneNumber, message);
    
    if (result.success) {
      console.log(`Message sent successfully to ${phoneNumber}`);
      
      // Update recipient status
      await Recipient.update(recipient.id, { 
        status: 'delivered',
        delivered_at: new Date().toISOString()
      });
    } else {
      throw new Error(result.error || 'Failed to send message');
    }
  } catch (error) {
    console.error(`Error processing recipient ${recipient.id}:`, error);
    
    // Update recipient with failure
    await Recipient.update(recipient.id, { 
      status: 'failed',
      failure_reason: error.message
    });
    
    throw error;
  }
}

/**
 * Format phone number for WhatsApp
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} - Formatted phone number or null if invalid
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove any non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Basic validation
  if (digits.length < 10) return null;
  
  return digits;
}

module.exports = {
  processCampaign,
  processFailedRecipients,
  processRecipient
}; 