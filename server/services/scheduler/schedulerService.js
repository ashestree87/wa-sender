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
}

module.exports = new SchedulerService(); 