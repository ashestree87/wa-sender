const db = require('../config/database');

class Campaign {
  static async create(campaignData) {
    // Format time windows to ensure they're in the correct format
    let timeWindowStart = campaignData.timeWindowStart;
    let timeWindowEnd = campaignData.timeWindowEnd;
    
    // If one is provided but not the other, set both to null
    if ((timeWindowStart && !timeWindowEnd) || (!timeWindowStart && timeWindowEnd)) {
      timeWindowStart = null;
      timeWindowEnd = null;
    }
    
    // Handle empty string for timestamp fields
    const scheduledStartTime = campaignData.scheduledStartTime && campaignData.scheduledStartTime.trim() !== '' 
      ? campaignData.scheduledStartTime 
      : null;
    
    const scheduledEndTime = campaignData.scheduledEndTime && campaignData.scheduledEndTime.trim() !== ''
      ? campaignData.scheduledEndTime
      : null;
    
    const { data, error } = await db.insert('campaigns', {
      user_id: campaignData.userId,
      name: campaignData.name,
      description: campaignData.description,
      message_template: campaignData.messageTemplate,
      use_ai: campaignData.useAI,
      ai_prompt: campaignData.aiPrompt,
      status: campaignData.status || 'draft',
      scheduled_start_time: scheduledStartTime,
      scheduled_end_time: scheduledEndTime,
      min_delay_seconds: parseInt(campaignData.minDelaySeconds) || 3,
      max_delay_seconds: parseInt(campaignData.maxDelaySeconds) || 5,
      daily_limit: parseInt(campaignData.dailyLimit) || 0,
      time_window_start: timeWindowStart,
      time_window_end: timeWindowEnd
    });

    if (error) throw error;
    return data[0];
  }

  static async findByUserId(userId) {
    const { data, error } = await db.getMany('campaigns', {
      user_id: userId
    }, {
      orderBy: {
        column: 'created_at',
        direction: 'DESC'
      }
    });

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await db.getOne('campaigns', {
      id: id
    });

    if (error) throw error;
    return data;
  }

  static async update(id, updateData) {
    console.log('Campaign.update called with ID:', id);
    console.log('Update data received:', JSON.stringify(updateData, null, 2));
    
    try {
      // Format time windows to ensure they're in the correct format (HH:MM)
      let timeWindowStart = updateData.timeWindowStart;
      let timeWindowEnd = updateData.timeWindowEnd;
      
      // If both are provided, ensure they're in the correct format
      if (timeWindowStart || timeWindowEnd) {
        // If one is provided but not the other, set both or neither
        if (!timeWindowStart && timeWindowEnd) timeWindowStart = null;
        if (timeWindowStart && !timeWindowEnd) timeWindowEnd = null;
      }
      
      // Handle empty string for timestamp fields
      const scheduledStartTime = updateData.scheduledStartTime && updateData.scheduledStartTime.trim() !== '' 
        ? updateData.scheduledStartTime 
        : null;
      
      const scheduledEndTime = updateData.scheduledEndTime && updateData.scheduledEndTime.trim() !== ''
        ? updateData.scheduledEndTime
        : null;
      
      const { data, error } = await db.update('campaigns', {
        name: updateData.name,
        description: updateData.description,
        message_template: updateData.messageTemplate,
        use_ai: updateData.useAI,
        ai_prompt: updateData.aiPrompt,
        status: updateData.status,
        scheduled_start_time: scheduledStartTime,
        scheduled_end_time: scheduledEndTime,
        min_delay_seconds: parseInt(updateData.minDelaySeconds) || 3,
        max_delay_seconds: parseInt(updateData.maxDelaySeconds) || 5,
        daily_limit: parseInt(updateData.dailyLimit) || 0,
        time_window_start: timeWindowStart,
        time_window_end: timeWindowEnd
      }, {
        id: id
      });

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }
      
      console.log('Update successful, returned data:', data);
      return data[0];
    } catch (error) {
      console.error('Error in Campaign.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    const { error } = await db.delete('campaigns', {
      id: id
    });

    if (error) throw error;
    return true;
  }

  static async updateStatus(id, status) {
    const validStatuses = ['draft', 'scheduled', 'in_progress', 'paused', 'completed', 'failed'];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    
    const { data, error } = await db.update('campaigns', { 
      status: status 
    }, {
      id: id
    });
    
    if (error) throw error;
    return data[0];
  }

  static async getRecipient(campaignId, recipientId) {
    try {
      console.log(`DB Query: Getting recipient ${recipientId} for campaign ${campaignId}`);
      
      const { data, error } = await db.getOne('recipients', {
        campaign_id: campaignId,
        id: recipientId
      });
      
      if (error) {
        console.error('Error in getRecipient:', error);
        throw error;
      }
      
      console.log('Recipient data:', data);
      return data;
    } catch (error) {
      console.error(`Failed to get recipient ${recipientId} for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  static async updateRecipientStatus(campaignId, recipientId, status) {
    try {
      console.log(`DB Query: Updating recipient ${recipientId} status to ${status}`);
      
      const validStatuses = ['pending', 'processing', 'sent', 'delivered', 'failed', 'skipped'];
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid recipient status: ${status}`);
      }
      
      const { data, error } = await db.update('recipients', {
        status: status
      }, {
        campaign_id: campaignId,
        id: recipientId
      });
      
      if (error) {
        console.error('Error in updateRecipientStatus:', error);
        throw error;
      }
      
      console.log('Updated recipient data:', data);
      return data[0];
    } catch (error) {
      console.error(`Failed to update recipient ${recipientId} status to ${status}:`, error);
      throw error;
    }
  }

  static async processBulkRecipients(campaignId, recipientsData) {
    try {
      console.log(`Processing ${recipientsData.length} bulk recipients for campaign ${campaignId}`);
      
      // Prepare the data for insertion
      const formattedRecipients = recipientsData.map(recipient => ({
        campaign_id: campaignId,
        name: recipient.name,
        phone_number: recipient.phoneNumber,
        status: 'pending'
      }));
      
      // Insert all recipients in a single operation
      const { data, error } = await db.insert('recipients', formattedRecipients);
      
      if (error) {
        console.error('Error in processBulkRecipients:', error);
        throw error;
      }
      
      console.log(`Successfully added ${data.length} recipients`);
      return data;
    } catch (error) {
      console.error(`Failed to process bulk recipients for campaign ${campaignId}:`, error);
      throw error;
    }
  }
}

module.exports = Campaign; 