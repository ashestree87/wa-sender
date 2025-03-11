const supabase = require('../config/database');

class Recipient {
  static async bulkCreate(recipients) {
    const { data, error } = await supabase
      .from('recipients')
      .insert(recipients.map(r => ({
        campaign_id: r.campaignId,
        phone_number: r.phoneNumber,
        name: r.name,
        status: 'pending'
      })))
      .select();

    if (error) throw error;
    return data;
  }

  static async findByCampaignId(campaignId) {
    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('campaign_id', campaignId);

    if (error) throw error;
    return data;
  }

  static async updateStatus(id, status, additionalData = {}) {
    const updateData = {
      status,
      ...additionalData
    };
    
    if (status === 'sent' && !updateData.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }
    
    if (status === 'delivered' && !updateData.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('recipients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateMessage(id, message) {
    const { data, error } = await supabase
      .from('recipients')
      .update({ message })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteByCampaignId(campaignId) {
    const { error } = await supabase
      .from('recipients')
      .delete()
      .eq('campaign_id', campaignId);

    if (error) throw error;
    return true;
  }
}

module.exports = Recipient; 