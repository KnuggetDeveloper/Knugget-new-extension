// Fixed src/background.ts - Restoring proper auth flow while keeping LinkedIn functionality

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
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      
      return true; // Keep message channel open
    });

    // External message handler (for auth from website) - RESTORED ORIGINAL LOGIC
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

  // Enhanced LinkedIn post save with proper backend integration
  async handleLinkedInPostSave(postData: any, sendResponse: (response: { success: boolean, message?: string, data?: any }) => void) {
    try {
      console.log("💼 Saving LinkedIn post:", postData.author);
      
      // Get auth token
      const result = await chrome.storage.local.get(["knugget_auth"]);
      const authData = result.knugget_auth;
      
      if (!authData || !authData.token) {
        sendResponse({ 
          success: false, 
          message: "Authentication required. Please log in to save posts." 
        });
        return;
      }

      // Prepare data for backend API - match your backend schema exactly
      const apiData = {
        author: postData.author || 'Unknown Author',
        content: postData.content || postData.text || '',
        postUrl: postData.url || postData.postUrl || '',
        engagement: postData.engagement ? {
          likes: postData.engagement.likes || 0,
          comments: postData.engagement.comments || 0,
          shares: postData.engagement.shares || 0,
        } : {
          likes: 0,
          comments: 0,
          shares: 0,
        },
        tags: postData.tags || [],
        // Add any other fields your backend expects based on SaveLinkedinPostDto
      };

      console.log("📤 Sending to backend API:", apiData);

      // Send to backend API - use correct route
      const response = await fetch('https://knugget-new-backend.onrender.com/api/linkedin/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`,
        },
        body: JSON.stringify(apiData),
      });

      console.log("📡 Backend response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend error response:", errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      console.log("✅ Backend response data:", responseData);

      if (responseData.success) {
        console.log("✅ LinkedIn post saved to backend successfully");
        
        // Store locally as backup/cache
        const localSavedPost = {
          ...postData,
          id: responseData.data?.id || `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          platform: "linkedin",
          savedAt: new Date().toISOString(),
          syncStatus: 'synced',
          backendData: responseData.data
        };

        await this.updateLocalStorage(localSavedPost);
        
        sendResponse({ 
          success: true, 
          message: responseData.message || "LinkedIn post saved successfully",
          data: responseData.data
        });
        
      } else {
        throw new Error(responseData.error || 'Failed to save post to backend');
      }
      
    } catch (error) {
      console.error("❌ Failed to save LinkedIn post to backend:", error);
      
      // Fallback: save locally if backend fails
      try {
        const fallbackPost = {
          ...postData,
          platform: "linkedin",
          savedAt: new Date().toISOString(),
          id: `linkedin_local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          syncStatus: 'pending', // Mark for later sync
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };

        await this.updateLocalStorage(fallbackPost);
        
        sendResponse({ 
          success: true, 
          message: "Post saved locally. Will sync when connection is restored.",
          data: fallbackPost
        });
        
        // Schedule retry
        this.scheduleRetrySync(fallbackPost);
        
      } catch (fallbackError) {
        console.error("❌ Fallback save also failed:", fallbackError);
        sendResponse({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Failed to save post'
        });
      }
    }
  }

  // Helper to update local storage
  async updateLocalStorage(post: any) {
    try {
      const result = await chrome.storage.local.get(["knugget_saved_posts"]);
      const savedPosts = result.knugget_saved_posts || [];
      
      // Remove existing post with same ID if exists
      const filteredPosts = savedPosts.filter((p: any) => p.id !== post.id);
      filteredPosts.push(post);
      
      await chrome.storage.local.set({ knugget_saved_posts: filteredPosts });
      console.log("✅ Local storage updated");
    } catch (error) {
      console.error("❌ Failed to update local storage:", error);
      throw error;
    }
  }

  // Schedule retry for failed posts
  async scheduleRetrySync(post: any) {
    console.log("⏱️ Scheduling retry sync for post:", post.id);
    
    // Retry after 30 seconds
    setTimeout(async () => {
      try {
        const result = await chrome.storage.local.get(["knugget_auth"]);
        const authData = result.knugget_auth;
        
        if (!authData || !authData.token) {
          console.log("❌ No auth token for retry sync");
          return;
        }

        console.log("🔄 Attempting retry sync for post:", post.id);

        const apiData = {
          author: post.author,
          content: post.content,
          postUrl: post.url || post.postUrl,
          engagement: post.engagement || { likes: 0, comments: 0, shares: 0 },
          tags: post.tags || [],
        };

            const response = await fetch('https://knugget-new-backend.onrender.com/api/linkedin/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.token}`,
          },
          body: JSON.stringify(apiData),
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log("✅ Retry sync successful for post:", post.id);
          
          // Update local storage to mark as synced
          post.syncStatus = 'synced';
          post.backendData = responseData.data;
          post.syncedAt = new Date().toISOString();
          delete post.errorMessage;
          
          await this.updateLocalStorage(post);
        } else {
          console.error("❌ Retry sync failed with status:", response.status);
        }
      } catch (error) {
        console.error("❌ Retry sync failed:", error);
        // Schedule another retry after longer delay
        setTimeout(() => this.scheduleRetrySync(post), 5 * 60 * 1000); // 5 minutes
      }
    }, 30000);
  }

  async handleLogout(sendResponse: (response: { success: boolean, error?: string }) => void) {
    try {
      console.log('🚪 Handling logout');
      
      // Clear auth storage
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

  // RESTORED ORIGINAL AUTH SUCCESS HANDLER
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

      // Notify all tabs of auth change
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

      // Trigger sync of pending posts after successful auth
      setTimeout(() => {
        this.syncPendingPosts();
      }, 1000);

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

  // RESTORED ORIGINAL ALLOWED ORIGINS FOR LOCALHOST
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

  // Enhanced periodic sync of pending posts
  async syncPendingPosts() {
    try {
      const result = await chrome.storage.local.get(["knugget_saved_posts", "knugget_auth"]);
      const savedPosts = result.knugget_saved_posts || [];
      const authData = result.knugget_auth;

      if (!authData || !authData.token) {
        console.log("ℹ️ No auth token available for sync");
        return;
      }

      const pendingPosts = savedPosts.filter((post: any) => post.syncStatus === 'pending');
      
      if (pendingPosts.length === 0) {
        console.log("ℹ️ No pending posts to sync");
        return;
      }

      console.log(`🔄 Syncing ${pendingPosts.length} pending posts...`);

      let syncedCount = 0;
      for (const post of pendingPosts) {
        try {
          const apiData = {
            author: post.author,
            content: post.content,
            postUrl: post.url || post.postUrl,
            engagement: post.engagement || { likes: 0, comments: 0, shares: 0 },
            tags: post.tags || [],
          };

          const response = await fetch('https://knugget-new-backend.onrender.com/api/linkedin/posts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.token}`,
            },
            body: JSON.stringify(apiData),
          });

          if (response.ok) {
            const responseData = await response.json();
            console.log("✅ Successfully synced pending post:", post.id);
            
            // Mark as synced
            post.syncStatus = 'synced';
            post.backendData = responseData.data;
            post.syncedAt = new Date().toISOString();
            delete post.errorMessage;
            
            syncedCount++;
          } else {
            console.error("❌ Failed to sync post:", post.id, "Status:", response.status);
          }
        } catch (error) {
          console.error("❌ Failed to sync post:", post.id, error);
        }

        // Add small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update storage with sync status
      await chrome.storage.local.set({ knugget_saved_posts: savedPosts });
      
      if (syncedCount > 0) {
        console.log(`✅ Successfully synced ${syncedCount} out of ${pendingPosts.length} pending posts`);
      }

    } catch (error) {
      console.error("❌ Error during periodic sync:", error);
    }
  }
}

// Initialize background service
const backgroundService = new SimpleBackgroundService();

// Set up periodic sync every 5 minutes
setInterval(() => {
  backgroundService.syncPendingPosts();
}, 5 * 60 * 1000);

// Also sync on startup after 10 seconds
setTimeout(() => {
  backgroundService.syncPendingPosts();
}, 10000);