class SimpleBackgroundService {
  constructor() {
    this.initialize();
  }

  initialize() {
    console.log("🎯 Knugget Multi-Platform Extension starting...");
    
    // Installation handler
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("Extension installed/updated:", details.reason);
      if (details.reason === "install") {
        chrome.tabs.create({
          url: "https://knugget-new-client.vercel.app/welcome?source=extension&version=2.0",
        });
      }
    });

    // Message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📨 Background received message:", message.type);
      
      try {
        switch (message.type) {
          case "CHECK_AUTH_STATUS":
            this.handleAuthCheck(sendResponse);
            break;
            
          case "OPEN_LOGIN_PAGE":
            this.openLoginPage(message.payload);
            sendResponse({ success: true });
            break;
            
          case "OPEN_DASHBOARD":
            chrome.tabs.create({ url: "https://knugget-new-client.vercel.app/dashboard" });
            sendResponse({ success: true });
            break;
            
          case "SAVE_LINKEDIN_POST":
            this.handleLinkedInPostSave(message.data, sendResponse);
            break;
            
          case "LOGOUT":
            this.handleLogout(sendResponse);
            break;
            
          default:
            console.log("Unknown message type:", message.type);
            sendResponse({ success: false, error: "Unknown message type" });
        }
      } catch (error) {
        console.error("Error handling message:", error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error'   });
      }
      
      return true; // Keep message channel open
    });

    // External message handler (for auth from website)
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      console.log("📨 External message received:", message.type);
      
      if (!sender.url) {
        sendResponse({ success: false, error: "Unauthorized origin" });
        return;
      }

      if (!this.isAllowedOrigin(sender.url)) {
        sendResponse({ success: false, error: "Unauthorized origin" });
        return;
      }

      switch (message.type) {
        case "KNUGGET_AUTH_SUCCESS":
          this.handleExternalAuthSuccess(message.payload, sendResponse);
          break;
        case "KNUGGET_LOGOUT":
          this.handleExternalLogout(sendResponse);
          break;
        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
      
      return true;
    });

    console.log("✅ Background service initialized");
  }

  async handleAuthCheck(sendResponse: (response: { isAuthenticated: boolean, user: any }) => void) {
    try {
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;
      
      if (authData && authData.token && authData.expiresAt > Date.now()) {
        sendResponse({
          isAuthenticated: true,
          user: authData.user
        });
      } else {
        sendResponse({
          isAuthenticated: false,
          user: null
        });
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      sendResponse({
        isAuthenticated: false,
        user: null
      });
    }
  }

  async handleLinkedInPostSave(postData: any, sendResponse: (response: { success: boolean, message?: string }) => void) {
    try {
      console.log("💼 Saving LinkedIn post:", postData.author);
      
      // Store locally for now
      const savedPost = {
        ...postData,
        platform: "linkedin",
        savedAt: new Date().toISOString(),
        id: `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const result = await chrome.storage.local.get(["knugget_saved_posts"]);
      const savedPosts = result.knugget_saved_posts || [];
      savedPosts.push(savedPost);
      
      await chrome.storage.local.set({ knugget_saved_posts: savedPosts });
      
      sendResponse({ success: true, message: "Post saved successfully" });
      console.log("✅ LinkedIn post saved successfully");
    } catch (error) {
      console.error("❌ Failed to save LinkedIn post:", error);
      sendResponse({ success: false, message: error instanceof Error ? error.message : 'Unknown error'});
    }
  }

  async handleLogout(sendResponse: (response: { success: boolean, error?: string }) => void) {
    try {
      console.log('🚪 Handling logout');
      
      // Clear storage
      await chrome.storage.local.remove(["knugget_auth"]);
      
      // Notify all tabs
      const tabs = await chrome.tabs.query({
        url: ["*://*.youtube.com/*", "*://*.linkedin.com/*"]
      });

      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "LOGOUT",
              data: { reason: 'User logout', timestamp: new Date().toISOString() }
            });
          } catch (e) {
            // Ignore if content script not loaded
          }
        }
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('❌ Logout error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleExternalAuthSuccess(payload: any, sendResponse: (response: { success: boolean, error?: string }) => void) {
    try {
      if (!payload || !payload.accessToken) {
        throw new Error("Invalid auth payload");
      }

      const authData = {
        token: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: {
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          credits: payload.user.credits || 0,
          plan: payload.user.plan === 'PREMIUM' ? 'premium' : 'free',
        },
        expiresAt: payload.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
        loginTime: new Date().toISOString(),
      };

      await chrome.storage.local.set({ knugget_auth: authData });

      // Notify all tabs
      const tabs = await chrome.tabs.query({
        url: ["*://*.youtube.com/*", "*://*.linkedin.com/*"]
      });

      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "AUTH_STATUS_CHANGED",
              data: {
                isAuthenticated: true,
                user: authData.user,
              }
            });
          } catch (e) {
            // Ignore if content script not loaded
          }
        }
      }

      sendResponse({ success: true });
      console.log("✅ External auth success handled");
    } catch (error) {
      console.error("❌ Failed to handle external auth success:", error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleExternalLogout(sendResponse: (response: { success: boolean, error?: string }) => void) {
    try {
      await this.handleLogout(() => {});
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  openLoginPage(payload: any) {
    const extensionId = chrome.runtime.id;
    const referrer = payload?.url ? `&referrer=${encodeURIComponent(payload.url)}` : "";
    const loginUrl = `https://knugget-new-client.vercel.app/login?source=extension&extensionId=${extensionId}${referrer}`;
    chrome.tabs.create({ url: loginUrl });
  }

  isAllowedOrigin(url: string) {
    try {
      const origin = new URL(url).origin;
      const allowedOrigins = [
        "https://knugget-new-client.vercel.app",
        "https://knugget-new-backend.onrender.com",
        "http://localhost:8000",
        "http://localhost:3000",
      ];
      return allowedOrigins.includes(origin);
    } catch {
      return false;
    }
  }
}

// Initialize background service
new SimpleBackgroundService();