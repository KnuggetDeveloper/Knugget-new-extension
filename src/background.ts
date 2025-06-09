// background.ts - Service Worker
import { authService } from "./services/auth";
import { MessageType, AuthData } from "./types";
import { config } from "./config";

class BackgroundService {
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    console.log("🎯 Knugget Background Service starting...");
    this.setupEventListeners();
    this.setupExternalMessageListener(); // CRITICAL FIX
    console.log("✅ Background service initialized");
  }

  private setupEventListeners(): void {
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("Extension installed/updated:", details.reason);
      if (details.reason === "install") {
        chrome.tabs.create({
          url: `${config.websiteUrl}/welcome?source=extension`,
        });
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }
  private setupExternalMessageListener(): void {
    chrome.runtime.onMessageExternal.addListener(
      (message, sender, sendResponse) => {
        console.log("📨 External message received:", message, "from:", sender.url);

        // Verify sender is from our allowed origins
        if (!sender.url || !this.isAllowedOrigin(sender.url)) {
          console.warn("❌ Message from unauthorized origin:", sender.url);
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
          case "KNUGGET_CHECK_AUTH":
            this.handleExternalAuthCheck(sendResponse);
            break;
          default:
            console.log("Unknown external message type:", message.type);
            sendResponse({ success: false, error: "Unknown message type" });
        }
        return true;
      }
    );
  }
  private async handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: Function): Promise<void> {
    console.log("📨 Internal message received:", message.type);

    try {
      switch (message.type) {
        case "CHECK_AUTH_STATUS":
          sendResponse({
            isAuthenticated: authService.isAuthenticated,
            user: authService.user,
          });
          break;

        case "OPEN_LOGIN_PAGE":
          this.openLoginPage(message.payload);
          sendResponse({ success: true });
          break;

        case "OPEN_DASHBOARD":
          chrome.tabs.create({ url: `${config.websiteUrl}/dashboard` });
          sendResponse({ success: true });
          break;

        case MessageType.REFRESH_TOKEN:
          const refreshed = await authService.refreshToken();
          sendResponse({ success: refreshed });
          break;

        // FIXED: Add explicit logout handling for internal messages
        case "LOGOUT":
        case MessageType.LOGOUT:
          console.log('🚪 Handling internal logout request')
          await authService.logout()
          await this.notifyAllYouTubeTabs(MessageType.LOGOUT, {
            reason: 'Internal logout',
            timestamp: new Date().toISOString()
          })
          sendResponse({ success: true });
          break;

        default:
          console.log("Unhandled internal message type:", message.type);
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  private async notifyAllYouTubeTabs(type: MessageType, data?: any): Promise<void> {
    console.log(`📡 Notifying all YouTube tabs of: ${type}`)
    
    try {
      // Query for all YouTube tabs
      const tabs = await chrome.tabs.query({ 
        url: ["*://*.youtube.com/*", "*://youtube.com/*"] 
      })
      
      console.log(`🔍 Found ${tabs.length} YouTube tabs`)
      
      if (tabs.length === 0) {
        console.log('⚠️ No YouTube tabs found to notify')
        return
      }

      // Send message to each tab with enhanced error handling
      const messagePromises = tabs.map(async (tab) => {
        if (!tab.id) {
          console.warn('⚠️ Tab has no ID, skipping:', tab.url)
          return { success: false, tabId: null, error: 'No tab ID' }
        }

        try {
          console.log(`📤 Sending ${type} message to tab ${tab.id}: ${tab.url}`)
          
          const response = await chrome.tabs.sendMessage(tab.id, { 
            type, 
            data,
            timestamp: new Date().toISOString()
          })
          
          console.log(`✅ Successfully notified tab ${tab.id}:`, response)
          return { success: true, tabId: tab.id, response }
          
        } catch (error) {
          // This is expected for tabs that don't have the content script loaded
          console.log(`ℹ️ Could not notify tab ${tab.id} (content script may not be loaded):`, error instanceof Error ? error.message : 'Unknown error')
          return { success: false, tabId: tab.id, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      // Wait for all messages to be sent
      const results = await Promise.allSettled(messagePromises)
      
      // Log summary
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      const failed = results.length - successful
      
      console.log(`📊 Notification summary: ${successful} successful, ${failed} failed out of ${tabs.length} tabs`)
      
      if (successful === 0) {
        console.warn('⚠️ No tabs were successfully notified! This might indicate a content script issue.')
      }
      
    } catch (error) {
      console.error('❌ Failed to query YouTube tabs:', error)
    }
  }
  private async testTabCommunication(): Promise<void> {
    console.log('🧪 Testing tab communication...')
    
    try {
      const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" })
      console.log(`Found ${tabs.length} YouTube tabs for testing`)
      
      for (const tab of tabs) {
        if (tab.id) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              type: 'TEST_CONNECTION',
              timestamp: new Date().toISOString()
            })
            console.log(`✅ Tab ${tab.id} responded:`, response)
          } catch (error) {
            console.log(`❌ Tab ${tab.id} not responding:`, error instanceof Error ? error.message : 'Unknown error')
          }
        }
      }
    } catch (error) {
      console.error('❌ Tab communication test failed:', error)
    }
  }
 private async handleExternalAuthSuccess(payload: any, sendResponse: Function): Promise<void> {
    try {
      if (!payload || !payload.accessToken) {
        throw new Error("Invalid auth payload");
      }

      const authData: AuthData = {
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

      // Store auth data using auth service
      await authService.handleExternalAuthChange(authData);

      // 🔴 CRITICAL: Notify all YouTube tabs about auth success
      this.notifyAllYouTubeTabs(MessageType.AUTH_STATUS_CHANGED, {
        isAuthenticated: true,
        user: authData.user,
      });

      sendResponse({ success: true });
      console.log("✅ External auth success handled");
    } catch (error) {
      console.error("❌ Failed to handle external auth success:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Auth handling failed",
      });
    }
  }


  private handleExternalAuthCheck(sendResponse: Function): void {
    sendResponse({
      isAuthenticated: authService.isAuthenticated,
      user: authService.user,
    });
  }

  private async handleExternalLogout(sendResponse: Function): Promise<void> {
    try {
      console.log('🚪 Handling external logout from frontend')
      
      // Clear extension auth data using auth service
      await authService.logout()
      
      // CRITICAL FIX: Enhanced notification to all YouTube tabs
      await this.notifyAllYouTubeTabs(MessageType.LOGOUT, {
        reason: 'Frontend logout',
        timestamp: new Date().toISOString()
      })
      
      sendResponse({ success: true })
      console.log('✅ External logout handled - extension auth cleared')
    } catch (error) {
      console.error('❌ Failed to handle external logout:', error)
      sendResponse({ success: false, error: 'Logout failed' })
    }
  }

  // private async syncAuthFromWebsite(): Promise<void> {
  //   try {
  //     console.log("🔄 Syncing auth from website...");
  //     const synced = await authService.syncFromWebsite();

  //     if (synced) {
  //       console.log("✅ Auth synced successfully");
  //       this.notifyAllTabs(MessageType.AUTH_STATUS_CHANGED, {
  //         isAuthenticated: true,
  //         user: authService.user,
  //       });
  //     } else {
  //       console.log("ℹ️ No auth found on website");
  //     }
  //   } catch (error) {
  //     console.error("❌ Failed to sync auth from website:", error);
  //   }
  // }

  // private async checkAuthStatus(): Promise<void> {
  //   // Check if token needs refresh
  //   if (authService.isAuthenticated) {
  //     const refreshed = await authService.refreshToken();
  //     if (refreshed) {
  //       console.log("✅ Token refreshed on startup");
  //     }
  //   } else {
  //     // Try to sync from website
  //     await this.syncAuthFromWebsite();
  //   }
  // }

  private openLoginPage(payload?: { url?: string }): void {
    const extensionId = chrome.runtime.id;
    const referrer = payload?.url ? `&referrer=${encodeURIComponent(payload.url)}` : "";
    const loginUrl = `${config.websiteUrl}/login?source=extension&extensionId=${extensionId}${referrer}`;
    
    chrome.tabs.create({ url: loginUrl });
  }

  private notifyAllTabs(type: MessageType, data?: any): void {
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type, data }).catch(() => {
            // Ignore errors for tabs that aren't ready
          });
        }
      });
    });
  }

  private isAllowedOrigin(url: string): boolean {
    try {
      const origin = new URL(url).origin;
      const allowedOrigins = [
        config.websiteUrl,
        "http://localhost:8000",
        "http://localhost:3000",
        "https://knugget.com",
        "https://knugget-new-backend.onrender.com",
        "https://knugget-new-client.vercel.app",
      ];
      return allowedOrigins.includes(origin);
    } catch {
      return false;
    }
  }

  // private handleExtensionUpdate(previousVersion: string): void {
  //   const currentVersion = chrome.runtime.getManifest().version;
  //   console.log(
  //     `Extension updated from ${previousVersion} to ${currentVersion}`
  //   );

  //   // Show update notification if it's a major update
  //   if (this.isMajorUpdate(previousVersion, currentVersion)) {
  //     chrome.notifications.create("knugget-update", {
  //       type: "basic",
  //       iconUrl: "icons/icon128.png",
  //       title: "Knugget Updated",
  //       message: `Updated to version ${currentVersion} with new features!`,
  //       buttons: [{ title: "See What's New" }],
  //     });
  //   }

  //   // Update settings with new version
  //   chrome.storage.local.get(["knuggetSettings"], (result) => {
  //     const settings = result.knuggetSettings || {};
  //     settings.version = currentVersion;
  //     chrome.storage.local.set({ knuggetSettings: settings });
  //   });
  // }

  // private isMajorUpdate(oldVersion: string, newVersion: string): boolean {
  //   try {
  //     const oldParts = oldVersion.split(".").map(Number);
  //     const newParts = newVersion.split(".").map(Number);

  //     // Major update if major or minor version increased
  //     return (
  //       newParts[0] > oldParts[0] ||
  //       (newParts[0] === oldParts[0] && newParts[1] > oldParts[1])
  //     );
  //   } catch {
  //     return false;
  //   }
  // }
}

// Handle notification clicks
chrome.notifications?.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    if (notificationId === "knugget-update" && buttonIndex === 0) {
      chrome.tabs.create({
        url: `${config.websiteUrl}/changelog?version=${
          chrome.runtime.getManifest().version
        }`,
      });
    }
  }
);

// Initialize background service
new BackgroundService();
