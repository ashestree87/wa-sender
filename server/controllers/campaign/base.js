const Campaign = require('../../models/Campaign');
const Recipient = require('../../models/Recipient');
const schedulerService = require('../../services/scheduler/schedulerService');

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
      scheduledEndTime,
      minDelaySeconds,
      maxDelaySeconds,
      dailyLimit,
      timeWindowStart,
      timeWindowEnd
    } = req.body;
    
    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      description,
      messageTemplate,
      useAI,
      aiPrompt,
      scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : null,
      scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null,
      minDelaySeconds: minDelaySeconds || 3,
      maxDelaySeconds: maxDelaySeconds || 5,
      dailyLimit: dailyLimit || 0,
      timeWindowStart,
      timeWindowEnd
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
    
    // Prepare the update data with proper field mapping
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      messageTemplate: req.body.messageTemplate,
      useAI: req.body.useAI,
      aiPrompt: req.body.aiPrompt,
      status: req.body.status || campaign.status,
      scheduledStartTime: req.body.scheduledStartTime && req.body.scheduledStartTime.trim() !== '' 
        ? req.body.scheduledStartTime 
        : null,
      scheduledEndTime: req.body.scheduledEndTime && req.body.scheduledEndTime.trim() !== ''
        ? req.body.scheduledEndTime
        : null,
      minDelaySeconds: parseInt(req.body.minDelaySeconds) || 3,
      maxDelaySeconds: parseInt(req.body.maxDelaySeconds) || 5,
      dailyLimit: parseInt(req.body.dailyLimit) || 0,
      timeWindowStart: req.body.timeWindowStart || null,
      timeWindowEnd: req.body.timeWindowEnd || null
    };
    
    // Validate time windows - if one is provided, both should be
    if ((updateData.timeWindowStart && !updateData.timeWindowEnd) || 
        (!updateData.timeWindowStart && updateData.timeWindowEnd)) {
      return res.status(400).json({ 
        message: 'Both start and end time windows must be provided together' 
      });
    }
    
    console.log('Update data prepared:', updateData);
    
    const updatedCampaign = await Campaign.update(req.params.id, updateData);
    
    if (updatedCampaign.status === 'scheduled' && updatedCampaign.scheduled_start_time) {
      schedulerService.scheduleCampaign(updatedCampaign);
    }
    
    res.json(updatedCampaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
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

// Duplicate a campaign
exports.duplicateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the original campaign
    const originalCampaign = await Campaign.findById(id);
    
    if (!originalCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the user is authorized to duplicate this campaign
    if (originalCampaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to duplicate this campaign' });
    }
    
    // Create a new campaign based on the original
    const newCampaign = await Campaign.create({
      userId: req.userId,
      name: `${originalCampaign.name} (Copy)`,
      description: originalCampaign.description,
      messageTemplate: originalCampaign.message_template || originalCampaign.messageTemplate,
      useAI: originalCampaign.use_ai || originalCampaign.useAI,
      aiPrompt: originalCampaign.ai_prompt || originalCampaign.aiPrompt,
      minDelaySeconds: originalCampaign.min_delay_seconds || 3,
      maxDelaySeconds: originalCampaign.max_delay_seconds || 5,
      dailyLimit: originalCampaign.daily_limit || 0,
      timeWindowStart: originalCampaign.time_window_start,
      timeWindowEnd: originalCampaign.time_window_end,
      status: 'draft' // Always start as draft
    });
    
    // Get original recipients if desired
    if (req.body.includeRecipients) {
      const originalRecipients = await Recipient.findByCampaignId(id);
      
      if (originalRecipients.length > 0) {
        // Create new recipients without statuses and sent times
        const newRecipients = originalRecipients.map(r => ({
          campaignId: newCampaign.id,
          name: r.name,
          phoneNumber: r.phone_number,
          status: 'pending',
          message: null
        }));
        
        await Recipient.bulkCreate(newRecipients);
      }
    }
    
    res.status(201).json({
      message: 'Campaign duplicated successfully',
      id: newCampaign.id,
      campaign: newCampaign
    });
  } catch (error) {
    console.error('Duplicate campaign error:', error);
    res.status(500).json({ message: 'Failed to duplicate campaign', error: error.message });
  }
}; 