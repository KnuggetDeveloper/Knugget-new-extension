// Complete updated src/background.ts with YouTube summary integration

class SimpleBackgroundService {
  constructor() {
    this.initialize();
  }

  initialize() {
    console.log("🎯 Knugget Extension starting...");

    // Installation handler
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("Extension installed/updated:", details.reason);
      console.log("Knugget AI Multi-Platform extension installed");
      if (details.reason === "install") {
        chrome.tabs.create({
          url: "https://knugget-new-client.vercel.app",
        });
      }
    });

    // Message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📨 Background received message:", message.type || message);

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
            chrome.tabs.create({
              url: "https://knugget-new-client.vercel.app/dashboard",
            });
            sendResponse({ success: true });
            break;

          case "LOGOUT":
            this.handleLogout(sendResponse);
            break;

          // YouTube-specific messages
          case "ping":
            console.log("Background script received ping from content script");
            sendResponse({
              success: true,
              message: "Background script active",
            });
            break;

          // YouTube Summary messages
          case "GENERATE_SUMMARY":
            this.handleGenerateSummary(message.payload, sendResponse);
            break;

          case "SAVE_SUMMARY":
            this.handleSaveSummary(message.payload, sendResponse);
            break;

          case "CHECK_EXISTING_SUMMARY":
            this.handleCheckExistingSummary(message.payload, sendResponse);
            break;

          case "getPostContent":
          case "getSelectedPost":
            // These are handled by content script to popup communication
            console.log("Content message received:", message);
            sendResponse({ success: true });
            break;

          // LinkedIn-specific messages
          case "SAVE_LINKEDIN_POST":
            this.handleSaveLinkedInPost(message.payload, sendResponse);
            break;

          case "LINKEDIN_POST_SAVED":
            console.log("LinkedIn post saved:", message.payload);
            // Notify other tabs if needed
            this.notifyLinkedInPostSaved(message.payload);
            sendResponse({ success: true });
            break;

          case "LINKEDIN_SAVE_FAILED":
            console.log("LinkedIn post save failed:", message.payload);
            sendResponse({ success: true });
            break;

          // Platform detection
          case "PLATFORM_ACTIVE":
            console.log(`Platform ${message.platform} is active`);
            sendResponse({ success: true });
            break;

          default:
            console.log("Unknown message type:", message.type || "no type");
            // Still respond with success for compatibility
            sendResponse({ success: true });
        }
      } catch (error) {
        console.error("Error handling message:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return true; // Keep message channel open
    });

    // External message handler (for auth from website)
    chrome.runtime.onMessageExternal.addListener(
      (message, sender, sendResponse) => {
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
      }
    );

    console.log("✅ Background service initialized with multi-platform support");
  }

  async handleAuthCheck(
    sendResponse: (response: { isAuthenticated: boolean; user: any }) => void
  ) {
    try {
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;

      if (authData && authData.token && authData.expiresAt > Date.now()) {
        sendResponse({
          isAuthenticated: true,
          user: authData.user,
        });
      } else {
        sendResponse({
          isAuthenticated: false,
          user: null,
        });
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      sendResponse({
        isAuthenticated: false,
        user: null,
      });
    }
  }

  async handleLogout(
    sendResponse: (response: { success: boolean; error?: string }) => void
  ) {
    try {
      console.log("🚪 Handling logout");

      // Clear auth storage
      await chrome.storage.local.remove(["knugget_auth"]);

      // Notify all tabs across all platforms
      const tabs = await chrome.tabs.query({
        url: ["*://*.youtube.com/*", "*://*.linkedin.com/*"],
      });

      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "LOGOUT",
              data: {
                reason: "User logout",
                timestamp: new Date().toISOString(),
              },
            });
          } catch (e) {
            // Ignore if content script not loaded
          }
        }
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error("❌ Logout error:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async handleExternalAuthSuccess(
    payload: any,
    sendResponse: (response: { success: boolean; error?: string }) => void
  ) {
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
          plan: payload.user.plan === "PREMIUM" ? "premium" : "free",
        },
        expiresAt: payload.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
        loginTime: new Date().toISOString(),
      };

      await chrome.storage.local.set({ knugget_auth: authData });

      // Notify all tabs across all platforms of auth change
      const tabs = await chrome.tabs.query({
        url: ["*://*.youtube.com/*", "*://*.linkedin.com/*"],
      });

      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "AUTH_STATUS_CHANGED",
              data: {
                isAuthenticated: true,
                user: authData.user,
              },
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
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async handleExternalLogout(
    sendResponse: (response: { success: boolean; error?: string }) => void
  ) {
    try {
      await this.handleLogout(() => {});
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // NEW: YouTube Summary handlers
  async handleGenerateSummary(
    payload: any,
    sendResponse: (response: { success: boolean; data?: any; error?: string }) => void
  ) {
    try {
      // Get auth data
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;

      if (!authData || !authData.token || authData.expiresAt <= Date.now()) {
        sendResponse({
          success: false,
          error: "Authentication required or expired"
        });
        return;
      }

      console.log("Making summary generation request to:", `https://knugget-new-backend.onrender.com/api/summary/generate`);

      // Make API request to backend
      const response = await fetch(`https://knugget-new-backend.onrender.com/api/summary/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }

        console.error("Summary generation failed:", response.status, errorMessage);
        sendResponse({
          success: false,
          error: errorMessage
        });
        return;
      }

      const result_1 = await response.json();
      console.log("Summary generated successfully via background:", result_1);

      sendResponse({
        success: true,
        data: result_1.data
      });

    } catch (error) {
      console.error("Error in handleGenerateSummary:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      });
    }
  }

  async handleSaveSummary(
    payload: any,
    sendResponse: (response: { success: boolean; data?: any; error?: string }) => void
  ) {
    try {
      // Get auth data
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;

      if (!authData || !authData.token || authData.expiresAt <= Date.now()) {
        sendResponse({
          success: false,
          error: "Authentication required or expired"
        });
        return;
      }

      console.log("Making summary save request to:", `https://knugget-new-backend.onrender.com/api/summary/save`);

      // Make API request to backend
      const response = await fetch(`https://knugget-new-backend.onrender.com/api/summary/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }

        console.error("Summary save failed:", response.status, errorMessage);
        sendResponse({
          success: false,
          error: errorMessage
        });
        return;
      }

      const result_1 = await response.json();
      console.log("Summary saved successfully via background:", result_1);

      sendResponse({
        success: true,
        data: result_1.data
      });

    } catch (error) {
      console.error("Error in handleSaveSummary:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      });
    }
  }

  async handleCheckExistingSummary(
    payload: any,
    sendResponse: (response: { success: boolean; data?: any; error?: string }) => void
  ) {
    try {
      const { videoId } = payload;
      
      // Get auth data
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;

      if (!authData || !authData.token || authData.expiresAt <= Date.now()) {
        sendResponse({
          success: false,
          error: "Authentication required or expired"
        });
        return;
      }

      console.log("Checking existing summary for video:", videoId);

      // Make API request to backend
      const response = await fetch(`https://knugget-new-backend.onrender.com/api/summary/video/${videoId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authData.token}`
        }
      });

      if (response.status === 404) {
        // No existing summary found
        sendResponse({
          success: true,
          data: null
        });
        return;
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }

        console.error("Check existing summary failed:", response.status, errorMessage);
        sendResponse({
          success: false,
          error: errorMessage
        });
        return;
      }

      const result_1 = await response.json();
      console.log("Found existing summary:", result_1);

      sendResponse({
        success: true,
        data: result_1.data
      });

    } catch (error) {
      console.error("Error in handleCheckExistingSummary:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      });
    }
  }

  // LinkedIn post saving (existing functionality)
  async handleSaveLinkedInPost(
    postData: any,
    sendResponse: (response: { success: boolean; data?: any; error?: string }) => void
  ) {
    try {
      // Get auth data
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;

      if (!authData || !authData.token || authData.expiresAt <= Date.now()) {
        sendResponse({
          success: false,
          error: "Authentication required or expired"
        });
        return;
      }

      console.log("Making LinkedIn post save request to:", `https://knugget-new-backend.onrender.com/api/linkedin/posts`);

      // Make API request to backend
      const response = await fetch(`https://knugget-new-backend.onrender.com/api/linkedin/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify(postData)
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }

        console.error("LinkedIn post save failed:", response.status, errorMessage);
        sendResponse({
          success: false,
          error: errorMessage
        });
        return;
      }

      const result_1 = await response.json();
      console.log("LinkedIn post saved successfully via background:", result_1);

      // Notify other LinkedIn tabs
      this.notifyLinkedInPostSaved(result_1.data);

      sendResponse({
        success: true,
        data: result_1.data
      });

    } catch (error) {
      console.error("Error in handleSaveLinkedInPost:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      });
    }
  }

  // Notify other LinkedIn tabs when a post is saved
  async notifyLinkedInPostSaved(postData: any) {
    try {
      const tabs = await chrome.tabs.query({
        url: ["*://*.linkedin.com/*"],
      });

      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "LINKEDIN_POST_SAVED_NOTIFICATION",
              data: postData,
            });
          } catch (e) {
            // Ignore if content script not loaded
          }
        }
      }
    } catch (error) {
      console.error("Failed to notify LinkedIn tabs:", error);
    }
  }

  openLoginPage(payload: any) {
    const extensionId = chrome.runtime.id;
    const referrer = payload?.url
      ? `&referrer=${encodeURIComponent(payload.url)}`
      : "";
    
    // Detect platform from referrer URL
    let platform = "unknown";
    if (payload?.url?.includes("youtube.com")) {
      platform = "youtube";
    } else if (payload?.url?.includes("linkedin.com")) {
      platform = "linkedin";
    }

    const loginUrl = `https://knugget-new-client.vercel.app/login?source=extension&extensionId=${extensionId}&platform=${platform}${referrer}`;
    chrome.tabs.create({ url: loginUrl });
  }

  isAllowedOrigin(url: string) {
    try {
      const origin = new URL(url).origin;
      const allowedOrigins = [
        "http://localhost:8000",
        "http://localhost:3000",
        "https://knugget-new-client.vercel.app",
        "https://knugget-new-backend.onrender.com",
      ];
      return allowedOrigins.includes(origin);
    } catch {
      return false;
    }
  }
}

// Initialize background service
const backgroundService = new SimpleBackgroundService();