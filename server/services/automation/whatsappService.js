const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isAuthenticated = false;
    this.qrCodeData = null;
    this.sessionDir = path.join(__dirname, '../../../sessions');
    
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    // Handle process termination
    process.on('SIGINT', async () => {
      await this.close();
      process.exit();
    });
  }
  
  async initialize(userId) {
    try {
      if (this.client && this.isAuthenticated) {
        console.log('Already initialized and authenticated');
        return true;
      }

      // Reset QR code data when starting a new initialization
      this.qrCodeData = null;
      
      // Create a new client if one doesn't exist
      if (!this.client) {
        console.log('Creating new WhatsApp client...');
        
        // Create user-specific auth directory
        const userSessionPath = path.join(this.sessionDir, `user_${userId}`);
        
        this.client = new Client({
          authStrategy: new LocalAuth({ 
            clientId: `user_${userId}`,
            dataPath: this.sessionDir
          }),
          puppeteer: {
            headless: false,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--window-size=1280,800'
            ]
          }
        });

        // Set up event handlers
        this.client.on('qr', async (qr) => {
          console.log('QR code received, converting to image...');
          // Convert QR code to data URL
          this.qrCodeData = await qrcode.toDataURL(qr);
          console.log('QR code converted to data URL');
        });

        this.client.on('ready', () => {
          console.log('WhatsApp client is ready!');
          this.isAuthenticated = true;
        });

        this.client.on('authenticated', () => {
          console.log('WhatsApp client authenticated');
          this.isAuthenticated = true;
        });

        this.client.on('auth_failure', (error) => {
          console.error('WhatsApp authentication failed:', error);
          this.isAuthenticated = false;
        });

        this.client.on('disconnected', (reason) => {
          console.log('WhatsApp client disconnected:', reason);
          this.isAuthenticated = false;
          this.client = null;
        });

        // Initialize the client
        console.log('Initializing WhatsApp client...');
        await this.client.initialize();
      }

      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }
  
  async getStatus() {
    // If not initialized at all
    if (!this.client) {
      return 'not_initialized';
    }

    // If we know we're authenticated
    if (this.isAuthenticated) {
      return 'authenticated';
    }

    // If we have a QR code, we're waiting for scan
    if (this.qrCodeData) {
      return 'awaiting_qr';
    }

    // Otherwise, we're in a loading state
    return 'loading';
  }

  async getQrCode() {
    return this.qrCodeData;
  }

  async waitForAuthentication(timeoutSeconds = 60) {
    if (this.isAuthenticated) {
      console.log('Already authenticated');
      return true;
    }
    
    try {
      console.log('Waiting for WhatsApp authentication...');
      
      // Wait for the isAuthenticated flag to become true
      const startTime = Date.now();
      while (!this.isAuthenticated) {
        // Check if timeout has been reached
        if ((Date.now() - startTime) > timeoutSeconds * 1000) {
          console.error('Authentication timed out');
          return false;
        }
        
        // Wait 1 second before checking again
        await this.waitForTimeout(1000);
      }
      
      console.log('WhatsApp authentication successful');
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }
  
  async sendMessage(phoneNumber, message) {
    try {
      // Check if client is initialized and authenticated
      if (!this.client || !this.isAuthenticated) {
        console.log('WhatsApp client not initialized or authenticated');
        return { success: false, error: 'WhatsApp not initialized or authenticated' };
      }
      
      // Format phone number (remove any non-numeric characters)
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Format the chat ID
      const chatId = `${formattedNumber}@c.us`;
      
      // Send the message
      console.log(`Sending message to ${chatId}...`);
      const result = await this.client.sendMessage(chatId, message);
      
      console.log('Message sent successfully:', result.id._serialized);
      return { success: true, messageId: result.id._serialized };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }
  
  async close() {
    try {
      if (this.client) {
        console.log('Closing WhatsApp client session...');
        
        // Try to destroy the client
        await this.client.destroy();
        console.log('WhatsApp client session closed successfully');
        
        // Reset state
        this.client = null;
        this.isAuthenticated = false;
        this.qrCodeData = null;
      } else {
        console.log('No active WhatsApp client session to close');
      }
    } catch (error) {
      console.error('Error in WhatsApp close method:', error);
      // Reset state even if there's an error
      this.client = null;
      this.isAuthenticated = false;
      this.qrCodeData = null;
    }
  }

  async waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async ensureInitialized(userId) {
    try {
      // If client is already initialized and authenticated, just return
      if (this.client && this.isAuthenticated) {
        return true;
      }
      
      // If client exists but is not authenticated, wait for authentication
      if (this.client) {
        const isAuth = await this.waitForAuthentication();
        if (isAuth) {
          return true;
        }
      }
      
      // Otherwise, initialize from scratch
      return await this.initialize(userId);
    } catch (error) {
      console.error('Error ensuring WhatsApp is initialized:', error);
      return false;
    }
  }

  async isConnected() {
    try {
      return this.client && this.isAuthenticated;
    } catch (error) {
      console.error('Error checking client connection:', error);
      return false;
    }
  }
}

module.exports = new WhatsAppService(); 