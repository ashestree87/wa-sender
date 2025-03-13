const schedule = require('node-schedule');
const Campaign = require('../../models/Campaign');
const Recipient = require('../../models/Recipient');
const whatsappService = require('../automation/whatsappService');
const messageGenerationService = require('../ai/messageGenerationService');
const supabase = require('../../config/database');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initializeScheduler();
    
    // Set up a daily job to check paused campaigns
    this.setupDailyChecks();
  }
  
  async initializeScheduler() {
    try {
      // Find all scheduled campaigns
      const { data: scheduledCampaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'scheduled')
        .gt('scheduled_start_time', new Date().toISOString());

      if (error) throw error;
      
      // Schedule each campaign
      for (const campaign of scheduledCampaigns) {
        this.scheduleCampaign(campaign);
      }
      
      console.log(`Initialized scheduler with ${scheduledCampaigns.length} campaigns`);
    } catch (error) {
      console.error('Error initializing scheduler:', error);
    }
  }
  
  scheduleCampaign(campaign) {
    // Cancel existing job if it exists
    if (this.jobs.has(campaign.id)) {
      this.jobs.get(campaign.id).cancel();
    }
    
    // Schedule the campaign to start at the specified time
    const job = schedule.scheduleJob(campaign.scheduled_start_time, async () => {
      try {
        // Update campaign status to running
        await Campaign.update(campaign.id, { status: 'running' });
        
        // Process the campaign
        await this.processCampaign(campaign.id);
      } catch (error) {
        console.error(`Error processing campaign ${campaign.id}:`, error);
      }
    });
    
    // Store the job
    this.jobs.set(campaign.id, job);
    
    console.log(`Scheduled campaign ${campaign.id} to start at ${campaign.scheduled_start_time}`);
  }
  
  async processCampaign(campaignId) {
    try {
      // First check if the campaign still exists before processing
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        console.log(`Campaign ${campaignId} no longer exists, skipping processing`);
        return; // Exit early if campaign doesn't exist
      }
      
      if (!campaign || campaign.status !== 'running') {
        return;
      }
      
      // Get all pending recipients for this campaign
      const recipients = await Recipient.findByCampaignId(campaignId);
      const pendingRecipients = recipients.filter(r => r.status === 'pending');
      
      if (pendingRecipients.length === 0) {
        // Mark campaign as completed if no pending recipients
        await Campaign.update(campaignId, { status: 'completed' });
        return;
      }
      
      // Initialize WhatsApp service
      await whatsappService.initialize(campaign.user_id);
      
      // Wait for authentication if needed
      const isAuthenticated = await whatsappService.waitForAuthentication();
      
      if (!isAuthenticated) {
        // Mark campaign as paused if authentication failed
        await Campaign.update(campaignId, { status: 'paused' });
        return;
      }
      
      // Process each recipient with random delays to simulate human behavior
      for (const recipient of pendingRecipients) {
        // Skip if campaign is no longer running
        const updatedCampaign = await Campaign.findById(campaignId);
        if (updatedCampaign.status !== 'running') {
          break;
        }
        
        // Generate message content
        let messageContent;
        if (campaign.use_ai) {
          messageContent = await messageGenerationService.generateMessage(
            campaign.message_template,
            campaign.ai_prompt,
            recipient.name
          );
        } else {
          // Use template with basic name replacement
          messageContent = campaign.message_template.replace('{name}', recipient.name || 'there');
        }
        
        // Store the generated message
        await Recipient.updateStatus(recipient.id, 'pending', { message: messageContent });
        
        // Send the message
        const result = await whatsappService.sendMessage(recipient.phone_number, messageContent);
        
        if (result.success) {
          // Update recipient status
          await Recipient.updateStatus(recipient.id, 'sent', { 
            sent_at: new Date().toISOString() 
          });
        } else {
          // Mark as failed
          await Recipient.updateStatus(recipient.id, 'failed', { 
            failure_reason: result.error 
          });
        }
        
        // Add a random delay between messages (2-5 seconds)
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 2000));
      }
      
      // Close WhatsApp service
      await whatsappService.close();
      
      // Check if all recipients have been processed
      const remainingRecipients = await Recipient.findByCampaignId(campaignId);
      const stillPending = remainingRecipients.filter(r => r.status === 'pending').length;
      
      if (stillPending === 0) {
        // Mark campaign as completed
        await Campaign.update(campaignId, { status: 'completed' });
      }
    } catch (error) {
      console.error(`Error processing campaign ${campaignId}:`, error);
      
      try {
        // Check if campaign still exists before trying to update it
        const campaignStillExists = await Campaign.findById(campaignId);
        if (campaignStillExists) {
          // Only update if campaign still exists
          await Campaign.update(campaignId, { status: 'paused' });
        } else {
          console.log(`Campaign ${campaignId} was deleted during processing, skipping status update`);
        }
      } catch (updateError) {
        console.error(`Could not update campaign ${campaignId} status:`, updateError);
        // Don't throw, just log
      }
    }
  }
  
  cancelCampaign(campaignId) {
    if (this.jobs.has(campaignId)) {
      this.jobs.get(campaignId).cancel();
      this.jobs.delete(campaignId);
      console.log(`Cancelled scheduled campaign ${campaignId}`);
      return true;
    }
    
    return false;
  }

  async processCampaignRecipients(campaign, recipients) {
    try {
      console.log(`Processing ${recipients.length} recipients for campaign ${campaign.id}`);
      console.log(`Campaign timing settings:
        - Min delay: ${campaign.min_delay_seconds || 3} seconds
        - Max delay: ${campaign.max_delay_seconds || 5} seconds
        - Daily limit: ${campaign.daily_limit || 'None'}
        - Time window: ${campaign.time_window_start || 'None'} - ${campaign.time_window_end || 'None'}
      `);
      
      // Get campaign timing settings
      const minDelay = campaign.min_delay_seconds || 3;
      const maxDelay = campaign.max_delay_seconds || 5;
      const dailyLimit = campaign.daily_limit || 0;
      const timeWindowStart = campaign.time_window_start;
      const timeWindowEnd = campaign.time_window_end;
      
      // Track messages sent today
      let messagesSentToday = 0;
      
      // Get count of messages already sent today if daily limit is set
      if (dailyLimit > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count, error } = await supabase
          .from('recipients')
          .select('id', { count: 'exact' })
          .eq('campaign_id', campaign.id)
          .eq('status', 'sent')
          .gte('sent_at', today.toISOString());
        
        if (!error) {
          messagesSentToday = count;
        }
      }
      
      // Initialize WhatsApp service
      await whatsappService.initialize();
      
      // Process each recipient
      for (const recipient of recipients) {
        // Check if campaign has been paused or deleted
        const currentCampaign = await Campaign.findById(campaign.id);
        if (!currentCampaign || currentCampaign.status !== 'in_progress') {
          console.log(`Campaign ${campaign.id} is no longer in progress, stopping processing`);
          await whatsappService.close();
          return;
        }
        
        // Check daily limit
        if (dailyLimit > 0 && messagesSentToday >= dailyLimit) {
          console.log(`Daily limit of ${dailyLimit} messages reached, pausing until tomorrow`);
          await Campaign.updateStatus(campaign.id, 'paused');
          await whatsappService.close();
          return;
        }
        
        // Check time window if set
        if (timeWindowStart && timeWindowEnd) {
          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes since midnight
          
          // Parse time window strings (format: "HH:MM")
          const [startHour, startMinute] = timeWindowStart.split(':').map(Number);
          const [endHour, endMinute] = timeWindowEnd.split(':').map(Number);
          
          const windowStart = startHour * 60 + startMinute;
          const windowEnd = endHour * 60 + endMinute;
          
          if (currentTime < windowStart || currentTime > windowEnd) {
            console.log(`Current time is outside sending window (${timeWindowStart}-${timeWindowEnd}), pausing`);
            await Campaign.updateStatus(campaign.id, 'paused');
            await whatsappService.close();
            return;
          }
        }
        
        // Generate message content
        let messageContent = campaign.message_template;
        
        // Replace placeholders
        messageContent = messageContent.replace(/{name}/g, recipient.name);
        
        // Use AI to enhance message if enabled
        if (campaign.use_ai && campaign.ai_prompt) {
          try {
            messageContent = await messageGenerationService.enhanceMessage(
              messageContent, 
              campaign.ai_prompt,
              recipient.name
            );
          } catch (aiError) {
            console.error('Error enhancing message with AI:', aiError);
            // Continue with original message if AI enhancement fails
          }
        }
        
        // Update recipient status to processing
        await Recipient.updateStatus(recipient.id, 'processing', { message: messageContent });
        
        // Send the message
        const result = await whatsappService.sendMessage(recipient.phone_number, messageContent);
        
        if (result.success) {
          // Update recipient status
          await Recipient.updateStatus(recipient.id, 'sent', { 
            sent_at: new Date().toISOString() 
          });
          messagesSentToday++;
        } else {
          // Mark as failed
          await Recipient.updateStatus(recipient.id, 'failed', { 
            failure_reason: result.error 
          });
        }
        
        // Add a random delay between messages using the configured min/max delay
        const delayMs = (Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Close WhatsApp service
      await whatsappService.close();
      
      // Check if all recipients have been processed
      const remainingRecipients = await Recipient.findByCampaignId(campaign.id);
      const stillPending = remainingRecipients.filter(r => r.status === 'pending').length;
      
      if (stillPending === 0) {
        // Mark campaign as completed if no pending recipients
        await Campaign.updateStatus(campaign.id, 'completed');
      }
    } catch (error) {
      console.error('Error processing campaign recipients:', error);
      // Try to close WhatsApp service in case of error
      try {
        await whatsappService.close();
      } catch (closeError) {
        console.error('Error closing WhatsApp service:', closeError);
      }
    }
  }

  // Add this method to check paused campaigns daily
  setupDailyChecks() {
    // Run at midnight every day
    const dailyJob = schedule.scheduleJob('0 0 * * *', async () => {
      try {
        console.log('Running daily campaign checks');
        await this.checkPausedCampaigns();
      } catch (error) {
        console.error('Error in daily campaign check:', error);
      }
    });
    
    // Also run every hour to check for time window campaigns
    const hourlyJob = schedule.scheduleJob('0 * * * *', async () => {
      try {
        console.log('Running hourly campaign checks');
        await this.checkPausedCampaigns();
      } catch (error) {
        console.error('Error in hourly campaign check:', error);
      }
    });
  }

  // Add this method to check and resume paused campaigns
  async checkPausedCampaigns() {
    try {
      // Get all paused campaigns
      const { data: pausedCampaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'paused');
        
      if (error) throw error;
      
      console.log(`Found ${pausedCampaigns.length} paused campaigns to check`);
      
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight
      
      for (const campaign of pausedCampaigns) {
        let shouldResume = false;
        let resumeReason = '';
        
        // Check if campaign was paused due to daily limit
        if (campaign.daily_limit > 0) {
          // Get count of messages sent today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const { count, error: countError } = await supabase
            .from('recipients')
            .select('id', { count: 'exact' })
            .eq('campaign_id', campaign.id)
            .eq('status', 'sent')
            .gte('sent_at', today.toISOString());
          
          if (!countError && count < campaign.daily_limit) {
            shouldResume = true;
            resumeReason = `Daily limit reset (${count}/${campaign.daily_limit})`;
          }
        }
        
        // Check if campaign was paused due to time window
        if (campaign.time_window_start && campaign.time_window_end) {
          // Parse time window strings (format: "HH:MM")
          const [startHour, startMinute] = campaign.time_window_start.split(':').map(Number);
          const [endHour, endMinute] = campaign.time_window_end.split(':').map(Number);
          
          const windowStart = startHour * 60 + startMinute;
          const windowEnd = endHour * 60 + endMinute;
          
          if (currentTime >= windowStart && currentTime <= windowEnd) {
            shouldResume = true;
            resumeReason = `Current time (${now.getHours()}:${now.getMinutes()}) is within sending window (${campaign.time_window_start}-${campaign.time_window_end})`;
          }
        }
        
        // Resume the campaign if conditions are met
        if (shouldResume) {
          console.log(`Resuming campaign ${campaign.id}: ${resumeReason}`);
          await Campaign.updateStatus(campaign.id, 'in_progress');
          
          // Get pending recipients and process them
          const recipients = await Recipient.findByCampaignId(campaign.id);
          const pendingRecipients = recipients.filter(r => r.status === 'pending');
          
          if (pendingRecipients.length > 0) {
            console.log(`Processing ${pendingRecipients.length} pending recipients for resumed campaign ${campaign.id}`);
            this.processCampaignRecipients(campaign, pendingRecipients);
          } else {
            console.log(`No pending recipients for campaign ${campaign.id}, marking as completed`);
            await Campaign.updateStatus(campaign.id, 'completed');
          }
        }
      }
    } catch (error) {
      console.error('Error checking paused campaigns:', error);
    }
  }
}

module.exports = new SchedulerService(); 