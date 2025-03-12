const whatsappService = require('../services/automation/whatsappService');

exports.initializeSession = async (req, res) => {
  try {
    console.log('Initializing WhatsApp session for user:', req.userId);
    
    // Start initialization
    await whatsappService.initialize(req.userId);
    
    // Check current status
    const status = await whatsappService.getStatus();
    
    if (status === 'authenticated') {
      console.log('WhatsApp already authenticated');
      res.json({ 
        message: 'WhatsApp session initialized and authenticated', 
        status: 'authenticated' 
      });
    } else if (status === 'awaiting_qr') {
      console.log('WhatsApp waiting for QR code scan');
      const qrCode = await whatsappService.getQrCode();
      res.json({ 
        message: 'Please scan the QR code with WhatsApp', 
        status: 'awaiting_qr',
        qrCode: qrCode
      });
    } else {
      console.log('WhatsApp initializing');
      res.json({ 
        message: 'WhatsApp session initializing', 
        status: status 
      });
    }
  } catch (error) {
    console.error('WhatsApp initialization error:', error);
    res.status(500).json({ 
      message: 'Failed to initialize WhatsApp', 
      error: error.message 
    });
  }
};

exports.getSessionStatus = async (req, res) => {
  try {
    const status = await whatsappService.getStatus();
    
    // If status is awaiting_qr, include the QR code
    if (status === 'awaiting_qr') {
      const qrCode = await whatsappService.getQrCode();
      res.json({ status, qrCode });
    } else {
      res.json({ status });
    }
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ message: 'Failed to get status', error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    await whatsappService.close();
    res.json({ message: 'WhatsApp session closed' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Failed to logout', error: error.message });
  }
};

exports.sendTestMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        message: 'Phone number and message are required' 
      });
    }

    const result = await whatsappService.sendMessage(phoneNumber, message);
    
    if (result.success) {
      res.json({ message: 'Message sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ 
        message: 'Failed to send message', 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      message: 'Failed to send message', 
      error: error.message 
    });
  }
}; 