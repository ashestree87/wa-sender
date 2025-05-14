const db = require('../config/database');

class Recipient {
  static async bulkCreate(recipients) {
    const { data, error } = await db.insert('recipients', 
      recipients.map(r => ({
        campaign_id: r.campaignId,
        phone_number: r.phoneNumber,
        name: r.name,
        status: 'pending'
      }))
    );

    if (error) throw error;
    return data;
  }

  static async findByCampaignId(campaignId) {
    const { data, error } = await db.getMany('recipients', {
      campaign_id: campaignId
    });

    if (error) throw error;
    return data;
  }

  static async update(id, updateData) {
    // Convert camelCase to snake_case for certain fields
    const dbData = {};
    for (const [key, value] of Object.entries(updateData)) {
      // Convert keys like phoneNumber to phone_number
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      dbData[dbKey] = value;
    }
    
    // Handle special fields for timestamps
    if (dbData.status === 'sent' && !dbData.sent_at) {
      dbData.sent_at = new Date().toISOString();
    }
    
    if (dbData.status === 'delivered' && !dbData.delivered_at) {
      dbData.delivered_at = new Date().toISOString();
    }
    
    const { data, error } = await db.update('recipients', dbData, {
      id: id
    });

    if (error) throw error;
    return data[0];
  }

  static async findById(id) {
    const { data, error } = await db.getOne('recipients', {
      id: id
    });

    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await db.delete('recipients', {
      id: id
    });

    if (error) throw error;
    return true;
  }

  static async deleteByCampaignId(campaignId) {
    const { error } = await db.delete('recipients', {
      campaign_id: campaignId
    });

    if (error) throw error;
    return true;
  }
}

module.exports = Recipient; 