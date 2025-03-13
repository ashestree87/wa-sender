const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const supabase = require('../../config/database');
require('dotenv').config();

class WhatsAppService {
  constructor() {
    this.clients = new Map(); // Map to store multiple client instances
    this.sessionDir = path.join(__dirname, '../../../sessions');
    
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    // Handle process termination
    process.on('SIGINT', async () => {
      await this.closeAll();
      process.exit();
    });
  }
  
  async initialize(userId, connectionId, connectionName) {
    try {
      // Check if this connection already exists and is authenticated
      const existingClient = this.clients.get(connectionId);
      if (existingClient && existingClient.isAuthenticated) {
        console.log(`Connection ${connectionId} already initialized and authenticated`);
        return { success: true, status: 'authenticated' };
      }

      // First, ensure the connection exists in the database
      await this.ensureConnectionInDb(userId, connectionId, connectionName);
      
      // Update status to initializing
      await this.updateConnectionInDb(connectionId, {
        status: 'initializing',
        updated_at: new Date().toISOString()
      });

      // Create a new client instance for this connection
      console.log(`Creating new WhatsApp client for connection ${connectionId}...`);
      
      // Create connection-specific auth directory
      const connectionSessionPath = path.join(this.sessionDir, `connection_${connectionId}`);
      
      const clientInstance = {
        client: new Client({
          authStrategy: new LocalAuth({ 
            clientId: `connection_${connectionId}`,
            dataPath: this.sessionDir
          }),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--window-size=1280,800'
            ]
          }
        }),
        isAuthenticated: false,
        qrCodeData: null,
        userId: userId,
        name: connectionName || `Connection ${connectionId.substring(0, 8)}`
      };

      // Set up event handlers
      clientInstance.client.on('qr', async (qr) => {
        console.log(`QR code received for connection ${connectionId}, converting to image...`);
        // Convert QR code to data URL
        clientInstance.qrCodeData = await qrcode.toDataURL(qr);
        
        // Update the connection status and QR code in the database
        await this.updateConnectionInDb(connectionId, {
          status: 'awaiting_qr',
          qr_code: clientInstance.qrCodeData,
          updated_at: new Date().toISOString()
        });
        
        console.log(`QR code converted to data URL for connection ${connectionId}`);
      });

      clientInstance.client.on('ready', async () => {
        console.log(`WhatsApp client is ready for connection ${connectionId}!`);
        clientInstance.isAuthenticated = true;
        
        // Get the client info including phone number
        try {
          const info = await clientInstance.client.info;
          const phoneNumber = info ? info.wid.user : 'Unknown';
          console.log(`WhatsApp authenticated with phone number: ${phoneNumber}`);
          
          // Update the connection status and phone number in the database
          await this.updateConnectionInDb(connectionId, {
            status: 'authenticated',
            phoneNumber: phoneNumber,
            last_active: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            qr_code: null
          });
        } catch (error) {
          console.error(`Error getting phone number for connection ${connectionId}:`, error);
          
          // Update the connection status without phone number
          await this.updateConnectionInDb(connectionId, {
            status: 'authenticated',
            last_active: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            qr_code: null
          });
        }
      });

      clientInstance.client.on('authenticated', async () => {
        console.log(`WhatsApp client authenticated for connection ${connectionId}`);
        clientInstance.isAuthenticated = true;
        
        // Update the connection status in the database
        await this.updateConnectionInDb(connectionId, {
          status: 'authenticated',
          last_active: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });

      clientInstance.client.on('auth_failure', async (error) => {
        console.error(`WhatsApp authentication failed for connection ${connectionId}:`, error);
        clientInstance.isAuthenticated = false;
        
        // Update the connection status in the database
        await this.updateConnectionInDb(connectionId, {
          status: 'auth_failed',
          updated_at: new Date().toISOString()
        });
      });

      clientInstance.client.on('disconnected', async (reason) => {
        console.log(`WhatsApp client disconnected for connection ${connectionId}:`, reason);
        clientInstance.isAuthenticated = false;
        
        // Update the connection status in the database
        await this.updateConnectionInDb(connectionId, {
          status: 'disconnected',
          updated_at: new Date().toISOString()
        });
        
        // Remove the client from our map
        this.clients.delete(connectionId);
      });

      // Store the client instance in our map
      this.clients.set(connectionId, clientInstance);

      // Initialize the client
      console.log(`Initializing WhatsApp client for connection ${connectionId}...`);
      
      // Initialize the client
      clientInstance.client.initialize().catch(async (error) => {
        console.error(`Error initializing client for connection ${connectionId}:`, error);
        await this.updateConnectionInDb(connectionId, {
          status: 'error',
          updated_at: new Date().toISOString()
        });
      });

      return { success: true, status: 'initializing' };
    } catch (error) {
      console.error(`Initialization error for connection ${connectionId}:`, error);
      
      // Update the connection status in the database
      await this.updateConnectionInDb(connectionId, {
        status: 'error',
        updated_at: new Date().toISOString()
      });
      
      return { success: false, error: error.message };
    }
  }
  
  async ensureConnectionInDb(userId, connectionId, connectionName) {
    try {
      // Check if the connection exists
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('id', connectionId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" error, which is expected if connection doesn't exist
        throw error;
      }
      
      // If connection doesn't exist, create it
      if (!data) {
        const { error: insertError } = await supabase
          .from('whatsapp_connections')
          .insert({
            id: connectionId,
            user_id: userId,
            name: connectionName || `Connection ${connectionId.substring(0, 8)}`,
            status: 'initializing',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) throw insertError;
      }
      
      return true;
    } catch (error) {
      console.error(`Error ensuring connection in DB for ${connectionId}:`, error);
      throw error;
    }
  }
  
  async updateConnectionInDb(connectionId, updates) {
    try {
      const { error } = await supabase
        .from('whatsapp_connections')
        .update(updates)
        .eq('id', connectionId);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error(`Error updating connection in DB for ${connectionId}:`, error);
      return false;
    }
  }
  
  async getStatus(connectionId) {
    try {
      // If connectionId is provided, get status for that specific connection
      if (connectionId) {
        const clientInstance = this.clients.get(connectionId);
        
        // Check database first
        const { data, error } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .eq('id', connectionId)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error(`Error getting connection from DB for ${connectionId}:`, error);
          return { status: 'error', error: error.message, success: false };
        }
        
        // If client exists in memory, check its status
        if (clientInstance) {
          if (clientInstance.isAuthenticated) {
            // Try to get phone number if available
            let phoneNumber = 'Unknown';
            try {
              const info = await clientInstance.client.info;
              phoneNumber = info ? info.wid.user : 'Unknown';
            } catch (error) {
              console.error(`Error getting phone number for connection ${connectionId}:`, error);
              // If we can't get info, the connection might be broken
              if (data && data.phoneNumber) {
                phoneNumber = data.phoneNumber; // Use stored phone number
              }
            }
            
            return { 
              status: 'authenticated', 
              phoneNumber: phoneNumber,
              success: true 
            };
          } else if (clientInstance.qrCodeData) {
            return { 
              status: 'awaiting_qr', 
              qrCode: clientInstance.qrCodeData,
              success: true 
            };
          } else {
            return { status: 'initializing', success: true };
          }
        }
        
        // If client doesn't exist in memory but database shows authenticated,
        // we need to reinitialize the client
        if (data && data.status === 'authenticated') {
          console.log(`Connection ${connectionId} is marked as authenticated in DB but not in memory. Consider reinitializing.`);
          
          // Return the database status but add a flag indicating reconnection might be needed
          return {
            status: data.status,
            phoneNumber: data.phoneNumber || 'Unknown',
            needsReconnect: true,
            success: true
          };
        }
        
        // Return database status if available
        if (data) {
          // Include phone number if authenticated
          if (data.status === 'authenticated' && data.phoneNumber) {
            return { 
              status: data.status, 
              phoneNumber: data.phoneNumber,
              success: true 
            };
          }
          
          if (data.status === 'awaiting_qr' && data.qr_code) {
            return { 
              status: 'awaiting_qr', 
              qrCode: data.qr_code,
              success: true 
            };
          }
          
          return { status: data.status || 'not_initialized', success: true };
        }
        
        return { status: 'not_found', success: false };
      } else {
        // If no connectionId provided, return general service status
        return { 
          status: 'service_ready', 
          activeConnections: this.clients.size,
          success: true 
        };
      }
    } catch (error) {
      console.error(`Error getting status for connection ${connectionId}:`, error);
      return { status: 'error', error: error.message, success: false };
    }
  }
  
  async getQrCode(connectionId) {
    try {
      const clientInstance = this.clients.get(connectionId);
      if (clientInstance && clientInstance.qrCodeData) {
        return { qrCode: clientInstance.qrCodeData, success: true };
      }
      
      // If client doesn't exist in memory or doesn't have QR code, check database
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('qr_code')
        .eq('id', connectionId)
        .single();
      
      if (error) {
        console.error(`Error getting QR code from DB for ${connectionId}:`, error);
        return { success: false, error: error.message };
      }
      
      if (data && data.qr_code) {
        return { qrCode: data.qr_code, success: true };
      }
      
      return { success: false, error: 'QR code not available' };
    } catch (error) {
      console.error(`Error getting QR code for connection ${connectionId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async waitForAuthentication(connectionId, timeoutSeconds = 60) {
    try {
      const clientInstance = this.clients.get(connectionId);
      if (!clientInstance) {
        return { success: false, error: 'Connection not initialized' };
      }
      
      if (clientInstance.isAuthenticated) {
        return { success: true };
      }
      
      // Wait for authentication with timeout
      const startTime = Date.now();
      const timeoutMs = timeoutSeconds * 1000;
      
      while (Date.now() - startTime < timeoutMs) {
        if (clientInstance.isAuthenticated) {
          return { success: true };
        }
        
        // Wait a bit before checking again
        await this.waitForTimeout(1000);
      }
      
      return { success: false, error: 'Authentication timeout' };
    } catch (error) {
      console.error(`Error waiting for authentication for connection ${connectionId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async sendMessage(connectionId, phoneNumber, message) {
    try {
      const clientInstance = this.clients.get(connectionId);
      
      // Check if client is initialized and authenticated
      if (!clientInstance || !clientInstance.isAuthenticated) {
        console.log(`WhatsApp client not initialized or authenticated for connection ${connectionId}`);
        return { success: false, error: 'WhatsApp not initialized or authenticated' };
      }
      
      // Format phone number (remove any non-numeric characters)
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Format the chat ID
      const chatId = `${formattedNumber}@c.us`;
      
      // Send the message
      console.log(`Sending message to ${chatId} from connection ${connectionId}...`);
      const result = await clientInstance.client.sendMessage(chatId, message);
      
      // Update last active timestamp
      await this.updateConnectionInDb(connectionId, {
        last_active: new Date().toISOString()
      });
      
      console.log(`Message sent successfully from connection ${connectionId}:`, result.id._serialized);
      return { success: true, messageId: result.id._serialized };
    } catch (error) {
      console.error(`Error sending WhatsApp message from connection ${connectionId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async close(connectionId) {
    try {
      const clientInstance = this.clients.get(connectionId);
      
      // First, update the database regardless of client instance
      await this.updateConnectionInDb(connectionId, {
        status: 'disconnected',
        updated_at: new Date().toISOString()
      });
      
      if (clientInstance) {
        console.log(`Closing WhatsApp client session for connection ${connectionId}...`);
        
        // Try to destroy the client
        try {
          await clientInstance.client.destroy();
          console.log(`WhatsApp client session closed successfully for connection ${connectionId}`);
        } catch (destroyError) {
          console.error(`Error destroying WhatsApp client for connection ${connectionId}:`, destroyError);
          // Continue with cleanup even if destroy fails
        }
        
        // Remove from our map
        this.clients.delete(connectionId);
        
        return true;
      } else {
        console.log(`No active WhatsApp client session in memory for connection ${connectionId}, but database updated`);
        return true; // Return true since we've updated the database
      }
    } catch (error) {
      console.error(`Error in WhatsApp close method for connection ${connectionId}:`, error);
      
      // Update the connection status in the database
      try {
        await this.updateConnectionInDb(connectionId, {
          status: 'error',
          updated_at: new Date().toISOString()
        });
      } catch (dbError) {
        console.error(`Failed to update connection status in database for ${connectionId}:`, dbError);
      }
      
      // Remove from our map even if there's an error
      this.clients.delete(connectionId);
      
      return false;
    }
  }
  
  async closeAll() {
    try {
      const connectionIds = Array.from(this.clients.keys());
      for (const connectionId of connectionIds) {
        await this.close(connectionId);
      }
      console.log('All WhatsApp connections closed');
      return true;
    } catch (error) {
      console.error('Error closing all WhatsApp connections:', error);
      return false;
    }
  }

  async waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createConnection(userId, name) {
    try {
      // Generate a new UUID for the connection
      const connectionId = crypto.randomUUID();
      
      // Create the connection in the database
      const { error } = await supabase
        .from('whatsapp_connections')
        .insert({
          id: connectionId,
          user_id: userId,
          name: name || `Connection ${connectionId.substring(0, 8)}`,
          status: 'not_initialized',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      return { success: true, connectionId };
    } catch (error) {
      console.error('Error creating WhatsApp connection:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getUserConnections(userId) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return { success: true, connections: data || [] };
    } catch (error) {
      console.error('Error getting user connections:', error);
      return { success: false, error: error.message };
    }
  }
  
  async deleteConnection(connectionId) {
    try {
      // First close the connection if it's active
      await this.close(connectionId);
      
      // Then delete from the database
      const { error } = await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('id', connectionId);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting WhatsApp connection:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppService(); 