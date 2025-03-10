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
    const { data, error } = await supabase
      .from('recipients')
      .update({
        status,
        ...additionalData
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = Recipient; 