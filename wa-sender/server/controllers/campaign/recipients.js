const Campaign = require('../../models/Campaign');
const Recipient = require('../../models/Recipient');

// Add recipients to a campaign
exports.addRecipients = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const recipients = await Recipient.bulkCreate(
      req.body.recipients.map(r => ({
        ...r,
        campaignId: req.params.id
      }))
    );
    
    res.status(201).json(recipients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a new endpoint for bulk recipient import
exports.importRecipients = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipients } = req.body;
    
    // Validate campaign ownership
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Validate recipients data
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'No valid recipients provided' });
    }
    
    // Process the bulk recipients
    const addedRecipients = await Campaign.processBulkRecipients(id, recipients);
    
    res.status(201).json({
      message: `Successfully imported ${addedRecipients.length} recipients`,
      count: addedRecipients.length,
      recipients: addedRecipients
    });
  } catch (error) {
    console.error('Error importing recipients:', error);
    res.status(500).json({ 
      message: 'Failed to import recipients', 
      error: error.message 
    });
  }
};

// Get recipients for a campaign
exports.getRecipients = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const recipients = await Recipient.findByCampaignId(req.params.id);
    res.json(recipients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update recipient status
exports.updateRecipientStatus = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    const { status } = req.body;
    
    // Validate campaign ownership
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update the recipient
    const recipient = await Recipient.update(recipientId, { status });
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    res.json(recipient);
  } catch (error) {
    console.error('Error updating recipient status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update recipient information (alias for better naming)
exports.updateRecipient = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    
    // Validate campaign ownership
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update the recipient
    const recipient = await Recipient.update(recipientId, req.body);
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    res.json(recipient);
  } catch (error) {
    console.error('Error updating recipient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Skip a recipient
exports.skipRecipient = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    
    // Validate campaign ownership
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update the recipient status to skipped
    const recipient = await Recipient.update(recipientId, { 
      status: 'skipped',
      failure_reason: 'Manually skipped by user'
    });
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    res.json({
      message: 'Recipient skipped successfully',
      recipient
    });
  } catch (error) {
    console.error('Error skipping recipient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset a recipient's status to pending
exports.resetRecipientStatus = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    
    // Validate campaign ownership
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update the recipient status to pending
    const recipient = await Recipient.update(recipientId, { 
      status: 'pending',
      failure_reason: null
    });
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    res.json({
      message: 'Recipient status reset to pending',
      recipient
    });
  } catch (error) {
    console.error('Error resetting recipient status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a recipient
exports.deleteRecipient = async (req, res) => {
  try {
    const { id, recipientId } = req.params;
    
    // Validate campaign ownership
    const campaign = await Campaign.findById(id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.user_id !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Delete the recipient
    const success = await Recipient.delete(recipientId);
    
    if (!success) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 