const supabase = require('../config/database');

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
    
    const { data, error } = await supabase
      .from('campaigns')
      .insert([{
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
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

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
      
      const { data, error } = await supabase
        .from('campaigns')
        .update({
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
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      console.log('Update successful, returned data:', data);
      return data;
    } catch (error) {
      console.error('Error in Campaign.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  static async updateStatus(id, status) {
    const validStatuses = ['draft', 'scheduled', 'in_progress', 'paused', 'completed', 'failed'];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getRecipient(campaignId, recipientId) {
    try {
      console.log(`DB Query: Getting recipient ${recipientId} for campaign ${campaignId}`);
      
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('id', recipientId)
        .single();
      
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
      
      const { data, error } = await supabase
        .from('recipients')
        .update({ status })
        .eq('campaign_id', campaignId)
        .eq('id', recipientId)
        .select()
        .single();
      
      if (error) {
        console.error('Error in updateRecipientStatus:', error);
        throw error;
      }
      
      console.log('Updated recipient data:', data);
      return data;
    } catch (error) {
      console.error(`Failed to update recipient ${recipientId} status to ${status}:`, error);
      throw error;
    }
  }
}

module.exports = Campaign; 