const supabase = require('../config/database');

class Campaign {
  static async create(campaignData) {
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
        scheduled_start_time: campaignData.scheduledStartTime,
        scheduled_end_time: campaignData.scheduledEndTime
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
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        name: updateData.name,
        description: updateData.description,
        message_template: updateData.messageTemplate,
        use_ai: updateData.useAI,
        ai_prompt: updateData.aiPrompt,
        status: updateData.status,
        scheduled_start_time: updateData.scheduledStartTime,
        scheduled_end_time: updateData.scheduledEndTime
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
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
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = Campaign; 