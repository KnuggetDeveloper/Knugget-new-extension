// src/background.ts - Enhanced background service with proper logout sync
import { authService } from "./shared/auth";
import { MessageType, AuthData } from "./types";
import { config } from "./config";

class BackgroundService {
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    console.log("🎯 Knugget Background Service starting...");
    this.setupEventListeners();
    this.setupExternalMessageListener();
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
        console.log("📨 External message received:", message.type, "from:", sender.url);

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

      await authService.handleExternalAuthChange(authData);

      // Notify all YouTube tabs about auth success
      await this.notifyAllYouTubeTabs(MessageType.AUTH_STATUS_CHANGED, {
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

      // Clear extension auth data
      await authService.logout()

      // Notify all YouTube tabs about logout
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

  private async notifyAllYouTubeTabs(type: MessageType, data?: any): Promise<void> {
    console.log(`📡 Notifying all YouTube tabs of: ${type}`)

    try {
      const tabs = await chrome.tabs.query({
        url: ["*://*.youtube.com/*", "*://youtube.com/*"]
      })

      console.log(`🔍 Found ${tabs.length} YouTube tabs`)

      if (tabs.length === 0) {
        console.log('⚠️ No YouTube tabs found to notify')
        return
      }

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
          console.log(`ℹ️ Could not notify tab ${tab.id} (content script may not be loaded):`, error instanceof Error ? error.message : 'Unknown error')
          return { success: false, tabId: tab.id, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      const results = await Promise.allSettled(messagePromises)
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

  private openLoginPage(payload?: { url?: string }): void {
    const extensionId = chrome.runtime.id;
    const referrer = payload?.url ? `&referrer=${encodeURIComponent(payload.url)}` : "";
    const loginUrl = `${config.websiteUrl}/login?source=extension&extensionId=${extensionId}${referrer}`;

    chrome.tabs.create({ url: loginUrl });
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
}

// Initialize background service
new BackgroundService();