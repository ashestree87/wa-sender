const whatsappService = require('../services/automation/whatsappService');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/database');

exports.initializeSession = async (req, res) => {
  try {
    const { connectionId, name } = req.body;
    
    if (!connectionId) {
      return res.status(400).json({ 
        message: 'Connection ID is required', 
        success: false 
      });
    }
    
    console.log(`Initializing WhatsApp session for user: ${req.userId}, connection: ${connectionId}`);
    
    // Start initialization
    const result = await whatsappService.initialize(req.userId, connectionId, name);
    
    if (!result.success) {
      return res.status(500).json({
        message: 'Failed to initialize WhatsApp',
        error: result.error,
        success: false
      });
    }
    
    // Check current status
    const status = await whatsappService.getStatus(connectionId);
    
    if (status.status === 'authenticated') {
      console.log(`WhatsApp already authenticated for connection ${connectionId}`);
      res.json({ 
        message: 'WhatsApp session initialized and authenticated', 
        status: 'authenticated',
        success: true
      });
    } else if (status.status === 'awaiting_qr') {
      console.log(`WhatsApp waiting for QR code scan for connection ${connectionId}`);
      res.json({ 
        message: 'Please scan the QR code with WhatsApp', 
        status: 'awaiting_qr',
        qrCode: status.qrCode,
        success: true
      });
    } else {
      console.log(`WhatsApp initializing for connection ${connectionId}`);
      res.json({ 
        message: 'WhatsApp session initializing', 
        status: status.status,
        success: true
      });
    }
  } catch (error) {
    console.error('WhatsApp initialization error:', error);
    res.status(500).json({ 
      message: 'Failed to initialize WhatsApp', 
      error: error.message,
      success: false
    });
  }
};

exports.getStatus = async (req, res) => {
  try {
    // Check if a specific connection ID was provided
    const { connectionId } = req.query;
    
    if (connectionId) {
      // Get status for a specific connection
      const status = await whatsappService.getStatus(connectionId);
      
      // Return the status
      res.json({
        ...status,
        success: true
      });
    } else {
      // Get all connections for this user
      const result = await whatsappService.getUserConnections(req.userId);
      
      if (!result.success) {
        return res.status(500).json({
          message: 'Failed to get WhatsApp connections',
          error: result.error,
          success: false
        });
      }
      
      // For each connection, get its current status
      const connections = [];
      for (const conn of result.connections) {
        const status = await whatsappService.getStatus(conn.id);
        
        connections.push({
          id: conn.id,
          name: conn.name,
          status: status.status,
          qr_code: status.qrCode,
          phoneNumber: status.phoneNumber,
          needsReconnect: status.needsReconnect || false,
          created_at: conn.created_at,
          updated_at: conn.updated_at
        });
      }
      
      res.json({
        connections,
        success: true
      });
    }
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      message: 'Failed to get WhatsApp status',
      error: error.message,
      success: false
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { connectionId } = req.body;
    
    if (!connectionId) {
      return res.status(400).json({ 
        message: 'Connection ID is required', 
        success: false 
      });
    }
    
    const result = await whatsappService.close(connectionId);
    
    if (result) {
      res.json({ message: 'WhatsApp session closed', success: true });
    } else {
      res.json({ 
        message: 'No active WhatsApp session to close', 
        success: true 
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      message: 'Failed to logout', 
      error: error.message,
      success: false
    });
  }
};

exports.sendTestMessage = async (req, res) => {
  try {
    const { connectionId, phoneNumber, message } = req.body;
    
    if (!connectionId || !phoneNumber || !message) {
      return res.status(400).json({ 
        message: 'Connection ID, phone number, and message are required',
        success: false
      });
    }

    const result = await whatsappService.sendMessage(connectionId, phoneNumber, message);
    
    if (result.success) {
      res.json({ 
        message: 'Message sent successfully', 
        messageId: result.messageId,
        success: true
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send message', 
        error: result.error,
        success: false
      });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      message: 'Failed to send message', 
      error: error.message,
      success: false
    });
  }
};

exports.createConnection = async (req, res) => {
  try {
    const { name } = req.body;
    
    const result = await whatsappService.createConnection(req.userId, name);
    
    if (result.success) {
      res.json({ 
        message: 'WhatsApp connection created', 
        connectionId: result.connectionId,
        success: true
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to create WhatsApp connection', 
        error: result.error,
        success: false
      });
    }
  } catch (error) {
    console.error('Create connection error:', error);
    res.status(500).json({ 
      message: 'Failed to create WhatsApp connection', 
      error: error.message,
      success: false
    });
  }
};

exports.deleteConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    if (!connectionId) {
      return res.status(400).json({ 
        message: 'Connection ID is required', 
        success: false 
      });
    }
    
    const result = await whatsappService.deleteConnection(connectionId);
    
    if (result.success) {
      res.json({ 
        message: 'WhatsApp connection deleted', 
        success: true 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to delete WhatsApp connection', 
        error: result.error,
        success: false
      });
    }
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ 
      message: 'Failed to delete WhatsApp connection', 
      error: error.message,
      success: false
    });
  }
};

// Debug endpoint to check client state
exports.debugClientState = async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    if (!connectionId) {
      return res.status(400).json({ 
        message: 'Connection ID is required', 
        success: false 
      });
    }
    
    // Get the client instance from the service
    const clientInstance = whatsappService.clients.get(connectionId);
    
    // Get the database record
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('id', connectionId)
      .single();
    
    if (error) {
      return res.status(500).json({
        message: 'Failed to get connection from database',
        error: error.message,
        success: false
      });
    }
    
    // Return debug information
    res.json({
      clientInMemory: !!clientInstance,
      clientAuthenticated: clientInstance ? clientInstance.isAuthenticated : false,
      databaseStatus: data ? data.status : 'not_found',
      databasePhoneNumber: data ? data.phoneNumber : null,
      needsReconnect: !clientInstance && data && data.status === 'authenticated',
      success: true
    });
  } catch (error) {
    console.error('Debug client state error:', error);
    res.status(500).json({
      message: 'Failed to debug client state',
      error: error.message,
      success: false
    });
  }
}; 