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
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated to WhatsApp Web' };
    }
    
    try {
      // Format phone number (remove any non-numeric characters)
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      console.log(`Sending message to ${formattedNumber}`);
      
      // Always use direct URL navigation which is more reliable
      console.log('Using direct URL navigation to chat');
      await this.page.goto(`https://web.whatsapp.com/send?phone=${formattedNumber}`, { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Wait for chat to load - try multiple selectors
      const chatSelectors = [
        'div[data-testid="conversation-panel-wrapper"]',
        'div[data-testid="conversation-panel"]',
        'footer',
        'div[data-testid="compose-box"]'
      ];
      
      let chatLoaded = false;
      for (const selector of chatSelectors) {
        try {
          await this.page.waitForSelector(selector, { 
            timeout: 15000,
            visible: true 
          });
          console.log(`Chat loaded (found ${selector})`);
          chatLoaded = true;
          break;
        } catch (err) {
          // Try next selector
        }
      }
      
      if (!chatLoaded) {
        throw new Error('Could not find chat input field');
      }
      
      // Wait a moment for the chat to fully load
      await this.waitForTimeout(1000);
      
      // Find and focus the input field using JavaScript
      const inputFocused = await this.page.evaluate(() => {
        try {
          // Look for the footer first
          const footer = document.querySelector('footer');
          if (!footer) return { success: false, error: 'No footer found' };
          
          // Find the input within the footer
          const input = footer.querySelector('div[contenteditable="true"]') || 
                        footer.querySelector('div[role="textbox"]') ||
                        footer.querySelector('div[data-tab="10"]');
          
          if (!input) {
            // Try to find any contenteditable div in the page
            const allInputs = document.querySelectorAll('div[contenteditable="true"]');
            // Filter out the search box
            const messageInputs = Array.from(allInputs).filter(el => {
              // Skip elements that are in the search area or have search-related attributes
              const isSearchBox = el.closest('[data-testid="chat-list-search"]') || 
                                 el.getAttribute('data-testid')?.includes('search') ||
                                 el.getAttribute('aria-label')?.includes('Search');
              return !isSearchBox;
            });
            
            if (messageInputs.length === 0) return { success: false, error: 'No message input found' };
            
            // Use the last one as it's likely the message input
            messageInputs[messageInputs.length - 1].focus();
            return { success: true, method: 'filtered contenteditable' };
          }
          
          // Focus the input
          input.focus();
          return { success: true, method: 'footer input' };
        } catch (error) {
          return { success: false, error: error.toString() };
        }
      });
      
      console.log('Input focus result:', inputFocused);
      
      if (!inputFocused.success) {
        throw new Error(`Failed to focus input: ${inputFocused.error}`);
      }
      
      // Type the message with human-like delays
      for (let i = 0; i < message.length; i++) {
        // Type each character
        await this.page.keyboard.type(message[i]);
        
        // Add random delay between keystrokes (20-80ms)
        await this.waitForTimeout(Math.floor(Math.random() * 60) + 20);
      }
      
      // Add a small delay before pressing Enter
      await this.waitForTimeout(Math.floor(Math.random() * 300) + 200);
      
      // Send the message using Enter key
      await this.page.keyboard.press('Enter');
      
      // Wait for message to be sent
      const sentSelectors = [
        'span[data-testid="msg-check"]',
        'span[data-testid="msg-dblcheck"]',
        'span[data-icon="msg-check"]',
        'span[data-icon="msg-dblcheck"]'
      ];
      
      let messageSent = false;
      for (const selector of sentSelectors) {
        try {
          await this.page.waitForSelector(selector, { 
            timeout: 10000 
          });
          console.log(`Message sent (found ${selector})`);
          messageSent = true;
          break;
        } catch (err) {
          // Try next selector
        }
      }
      
      if (!messageSent) {
        console.log('Could not confirm message was sent, but continuing');
      }
      
      // Add a shorter delay before the next message
      await this.waitForTimeout(Math.floor(Math.random() * 1000) + 1000);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isAuthenticated = false;
    }
  }

  async waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new WhatsAppService(); 