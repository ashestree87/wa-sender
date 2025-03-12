const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
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
  
  async findChromePath() {
    const commonPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.CHROME_PATH
    ];

    for (const path of commonPaths) {
      if (path && fs.existsSync(path)) {
        return path;
      }
    }

    throw new Error('Chrome not found. Please set CHROME_PATH environment variable.');
  }
  
  async initialize(userId) {
    try {
      if (this.browser && this.page && this.isAuthenticated) {
        console.log('Already initialized and authenticated');
        return true;
      }

      const userSessionPath = path.join(this.sessionDir, `user_${userId}`);
      
      if (!fs.existsSync(userSessionPath)) {
        fs.mkdirSync(userSessionPath, { recursive: true });
      }

      if (!this.browser) {
        const chromePath = await this.findChromePath();
        console.log('Launching new browser session...');
        this.browser = await puppeteer.launch({
          headless: false,
          executablePath: chromePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1280,800'
          ],
          ignoreDefaultArgs: ['--enable-automation'],
          userDataDir: userSessionPath
        });

        // Handle browser disconnection
        this.browser.on('disconnected', () => {
          console.log('Browser disconnected');
          
          // Only log as an error if it wasn't an intentional close
          if (!this._intentionalClose) {
            console.error('Browser disconnected unexpectedly');
          }
          
          // Reset state
          this.browser = null;
          this.page = null;
          this.isAuthenticated = false;
        });

        // Get the first page that opens with the browser
        const pages = await this.browser.pages();
        this.page = pages[0]; // Use the first tab instead of creating a new one
        
        await this.page.setViewport({ 
          width: 1280, 
          height: 800 
        });

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        console.log('Navigating to WhatsApp Web...');
        await this.page.goto('https://web.whatsapp.com', { 
          waitUntil: 'networkidle0',
          timeout: 60000 
        });

        // Inject WAPI script to expose WhatsApp's internal API
        await this.injectWAPI();

        // Check for authentication using multiple selectors
        const possibleSelectors = [
          'div[data-testid="chat-list"]',
          'div[data-icon="chat"]',
          '#pane-side',
          '[aria-label="Chat list"]',
          '.two',
          'span[data-icon="default-user"]'
        ];
        
        for (const selector of possibleSelectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              this.isAuthenticated = true;
              console.log(`Already authenticated (found ${selector})`);
              return true;
            }
          } catch (err) {
            // Ignore errors and try next selector
          }
        }

        console.log('Waiting for QR code scan or automatic login...');
        return false;
      }

      return this.isAuthenticated;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }
  
  async injectWAPI() {
    console.log('Injecting WAPI script to expose WhatsApp Web API...');
    
    // More comprehensive script to expose WhatsApp's internal API
    const wapiScript = `
      window.WAPI = {};
      
      // Function to get WhatsApp internal Store
      window.getStore = (modules) => {
        let foundStore = {};
        
        // Scan modules to find Store objects
        modules.forEach((module) => {
          if (module && module.default) {
            if (module.default.Chat) foundStore.Chat = module.default.Chat;
            if (module.default.Msg) foundStore.Msg = module.default.Msg;
            if (module.default.State) foundStore.State = module.default.State;
            if (module.default.Cmd) foundStore.Cmd = module.default.Cmd;
            if (module.default.SendMessage) foundStore.SendMessage = module.default.SendMessage;
            if (module.default.createGroup) foundStore.GroupUtils = module.default;
          }
          
          // Look for functions in module
          if (typeof module === 'object') {
            Object.keys(module).forEach(key => {
              if (key === 'default' || key === 'toString') return;
              
              if (key === 'createGroup') foundStore.GroupUtils = module;
              if (key === 'sendTextMsgToChat') foundStore.SendUtils = module;
            });
          }
        });
        
        return foundStore;
      };
      
      // Wait for webpack to load
      const findStore = () => {
        if (window.webpackChunkwhatsapp_web_client && window.webpackChunkwhatsapp_web_client.length) {
          try {
            // Get webpack modules
            let modules = [];
            window.webpackChunkwhatsapp_web_client.forEach(chunk => {
              if (chunk[1]) {
                Object.keys(chunk[1]).forEach(key => {
                  modules.push(chunk[1][key]);
                });
              }
            });
            
            // Find Store in modules
            window.Store = window.getStore(modules);
            
            // Add helper functions
            window.WAPI.openChat = (id) => {
              if (window.Store && window.Store.Chat && window.Store.Cmd) {
                const chat = window.Store.Chat.get(id);
                if (chat) {
                  window.Store.Cmd.openChatAt(chat);
                  return true;
                }
              }
              return false;
            };
            
            return window.Store && window.Store.Chat && window.Store.Cmd;
          } catch (e) {
            console.error('Error in WAPI initialization:', e);
            return false;
          }
        }
        return false;
      };
      
      // Try to find Store immediately
      if (!findStore()) {
        // If not found, set up a watcher
        const storeWatcher = setInterval(() => {
          if (findStore()) {
            console.log('WhatsApp Store found and initialized');
            clearInterval(storeWatcher);
          }
        }, 1000);
      } else {
        console.log('WhatsApp Store found immediately');
      }
    `;
    
    // Inject the script
    await this.page.evaluate(wapiScript);
    
    // Wait for WAPI to be initialized
    let wapiInitialized = false;
    for (let i = 0; i < 10; i++) {
      wapiInitialized = await this.page.evaluate(() => {
        return window.Store && window.Store.Chat && window.Store.Cmd;
      });
      
      if (wapiInitialized) {
        console.log('WAPI initialized successfully');
        break;
      }
      
      await this.waitForTimeout(1000);
    }
    
    if (!wapiInitialized) {
      console.log('Could not initialize WAPI, will fall back to URL navigation');
    }
    
    return wapiInitialized;
  }
  
  async getStatus() {
    // If not initialized at all
    if (!this.page) {
      return 'not_initialized';
    }

    // If we know we're authenticated
    if (this.isAuthenticated) {
      return 'authenticated';
    }

    try {
      // Try multiple possible selectors for the chat list
      const possibleSelectors = [
        'div[data-testid="chat-list"]',
        'div[data-icon="chat"]',
        '#pane-side',
        '[aria-label="Chat list"]',
        '.two',
        'span[data-icon="default-user"]'
      ];
      
      for (const selector of possibleSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            this.isAuthenticated = true;
            return 'authenticated';
          }
        } catch (err) {
          // Ignore errors and try next selector
        }
      }

      // Check for QR code
      try {
        const qrSelectors = [
          'div[data-testid="qrcode"]',
          'canvas',
          'div[data-ref]',
          '[data-icon="intro-md-beta-logo-dark"]'
        ];
        
        for (const selector of qrSelectors) {
          const element = await this.page.$(selector);
          if (element) {
            return 'awaiting_qr';
          }
        }
      } catch (err) {
        // Ignore errors
      }
      
      return 'loading';
    } catch (error) {
      console.error('Get status error:', error);
      return 'error';
    }
  }

  async waitForAuthentication() {
    if (this.isAuthenticated) {
      console.log('Already authenticated');
      return true;
    }
    
    try {
      console.log('Waiting for WhatsApp authentication...');
      
      // Try multiple possible selectors for the chat list
      const possibleSelectors = [
        'div[data-testid="chat-list"]',
        'div[data-icon="chat"]',
        '#pane-side',
        '[aria-label="Chat list"]',
        '.two',
        'span[data-icon="default-user"]'
      ];
      
      // Wait for any of these selectors to appear
      for (let i = 0; i < 30; i++) { // Try for 30 seconds
        for (const selector of possibleSelectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              this.isAuthenticated = true;
              console.log(`WhatsApp authentication successful (found ${selector})`);
              return true;
            }
          } catch (err) {
            // Ignore errors and try next selector
          }
        }
        
        // Wait 1 second before trying again
        await this.waitForTimeout(1000);
      }
      
      console.error('Authentication failed: No chat list selector found');
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }
  
  async sendMessage(phoneNumber, message) {
    try {
      // Check if browser is connected
      const isConnected = await this.isConnected();
      if (!isConnected) {
        console.log('Browser is not connected, cannot send message');
        return { success: false, error: 'Browser not connected' };
      }
      
      // Format phone number (remove any non-numeric characters)
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Check if the page is still valid
      if (!this.page) {
        return { success: false, error: 'WhatsApp page not initialized' };
      }
      
      // Try to use WhatsApp Web API if available
      try {
        const chatOpened = await this.page.evaluate((number) => {
          if (window.WAPI && window.WAPI.openChat) {
            return window.WAPI.openChat(`${number}@c.us`);
          }
          return false;
        }, formattedNumber);
        
        if (chatOpened) {
          console.log(`Chat opened for ${formattedNumber} using WAPI`);
        } else {
          // Fall back to URL navigation
          await this.page.goto(`https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
        }
      } catch (apiError) {
        console.error('Error using WAPI, falling back to URL navigation:', apiError);
        
        // Fall back to URL navigation
        await this.page.goto(`https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
      }
      
      // Wait for chat to load
      try {
        await this.page.waitForSelector('footer, div[data-testid="conversation-panel-footer"]', { timeout: 30000 });
        console.log('Chat loaded (found footer)');
      } catch (selectorError) {
        // Check if we got an invalid number error
        const invalidNumberSelector = 'div[data-testid="popup-contents"]';
        const invalidNumber = await this.page.$(invalidNumberSelector);
        
        if (invalidNumber) {
          console.error(`Invalid phone number: ${phoneNumber}`);
          return { success: false, error: 'Invalid phone number' };
        }
        
        console.error('Error waiting for chat to load:', selectorError);
        return { success: false, error: 'Chat failed to load' };
      }
      
      // If we used WAPI to open chat, we need to type the message
      if (!message.includes(encodeURIComponent(message))) {
        // Click on input field
        try {
          const inputSelector = 'div[contenteditable="true"][data-tab="10"]';
          await this.page.waitForSelector(inputSelector, { timeout: 5000 });
          await this.page.click(inputSelector);
          
          // Type message
          await this.page.keyboard.type(message);
        } catch (inputError) {
          console.error('Error focusing input field:', inputError);
          
          // Try alternative method
          const inputFocusResult = await this.page.evaluate(() => {
            const inputs = [
              document.querySelector('div[contenteditable="true"][data-tab="10"]'),
              document.querySelector('div[role="textbox"]'),
              document.querySelector('footer div[contenteditable="true"]'),
              document.querySelector('div[data-testid="conversation-compose-box-input"]')
            ];
            
            for (const input of inputs) {
              if (input) {
                try {
                  input.focus();
                  return { success: true, method: input.getAttribute('data-testid') || 'footer input' };
                } catch (e) {
                  // Try next input
                }
              }
            }
            
            return { success: false, error: 'No input field found' };
          });
          
          console.log('Input focus result:', inputFocusResult);
          
          if (!inputFocusResult.success) {
            return { success: false, error: 'Could not focus input field' };
          }
          
          // Type message
          await this.page.keyboard.type(message);
        }
      }
      
      // Send message
      await this.page.keyboard.press('Enter');
      
      // Wait for message to be sent
      try {
        // Look for double check mark or other sent indicators
        await this.page.waitForFunction(() => {
          const sentMarkers = [
            document.querySelector('span[data-icon="msg-check"]'),
            document.querySelector('span[data-icon="msg-dblcheck"]'),
            document.querySelector('span[data-testid="msg-check"]'),
            document.querySelector('span[data-testid="msg-dblcheck"]')
          ];
          
          return sentMarkers.some(marker => marker !== null);
        }, { timeout: 15000 });
        
        console.log('Message sent (found span[data-icon="msg-dblcheck"])');
        return { success: true };
      } catch (sentError) {
        console.error('Error waiting for message to be sent:', sentError);
        return { success: false, error: 'Message may not have been sent' };
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }
  
  async close() {
    try {
      if (this.browser) {
        console.log('Closing WhatsApp browser session...');
        
        // Set a flag to indicate we're intentionally closing
        this._intentionalClose = true;
        
        // Try to close gracefully
        try {
          await this.browser.close();
          console.log('WhatsApp browser session closed successfully');
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
          // Try to force close if normal close fails
          try {
            if (this.browser.process()) {
              this.browser.process().kill('SIGKILL');
              console.log('Browser process killed');
            }
          } catch (killError) {
            console.error('Error force-killing browser process:', killError);
          }
        }
        
        // Reset state regardless of close success
        this.browser = null;
        this.page = null;
        this.isAuthenticated = false;
        console.log('WhatsApp browser session state reset');
      } else {
        console.log('No active WhatsApp browser session to close');
      }
    } catch (error) {
      console.error('Error in WhatsApp close method:', error);
      // Reset state even if there's an error
      this.browser = null;
      this.page = null;
      this.isAuthenticated = false;
    } finally {
      // Clear the intentional close flag
      this._intentionalClose = false;
    }
  }

  async waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async ensureInitialized(userId) {
    try {
      // If browser is already initialized and authenticated, just return
      if (this.browser && this.page && this.isAuthenticated) {
        return true;
      }
      
      // If browser exists but is not authenticated, try to authenticate
      if (this.browser && this.page) {
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
      if (!this.browser) {
        return false;
      }
      
      // Check if browser is connected
      return !this.browser.disconnected;
    } catch (error) {
      console.error('Error checking browser connection:', error);
      return false;
    }
  }
}

module.exports = new WhatsAppService(); 