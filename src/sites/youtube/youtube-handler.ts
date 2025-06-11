import { SiteHandler } from '../base/site-handler.interface';
import { transcriptService } from '../../services/transcript';
import { User } from '../../types';
import { getVideoId, debounce } from '../../utils/dom';

export class YouTubeHandler implements SiteHandler {
  private currentVideoId: string | null = null;
  private knuggetPanel: HTMLElement | null = null;
  private authState = {
    isAuthenticated: false,
    user: null as User | null,
  };

  async initialize(): Promise<void> {
    console.log("🎯 YouTube Handler initializing...");

    if (!this.isYouTubeWatchPage()) {
      console.log("Not on YouTube watch page, current URL:", window.location.href);
      return;
    }

    const videoId = getVideoId();
    console.log(`Initializing Knugget AI for video ID: ${videoId}`);

    this.setupURLChangeDetection();
    this.setupMessageListener();
    this.initializeAuthState();

    if (videoId) {
      this.processCurrentPage(videoId);
    }

    console.log("✅ YouTube Handler initialized");
  }

  private isYouTubeWatchPage(): boolean {
    const pathname = window.location.pathname;
    const search = window.location.search;
    return pathname === "/watch" && search.includes("v=");
  }

  private processCurrentPage(videoId: string | null): void {
    console.log(`YouTube: Processing page for video ID ${videoId}`);

    if (this.currentVideoId !== videoId) {
      this.currentVideoId = videoId;
      this.resetContentData();
    }

    chrome.runtime
      .sendMessage({
        type: "PAGE_LOADED",
        payload: { url: window.location.href, videoId },
      })
      .catch(() => {
        // Ignore errors if background script is not ready
      });

    this.removeExistingPanel();

    setTimeout(() => {
      this.observeForSecondaryColumn();
    }, 100);
  }

  private observeForSecondaryColumn(): void {
    const secondaryColumn = document.getElementById("secondary");
    if (secondaryColumn) {
      console.log("✅ YouTube secondary column found immediately!");
      this.injectKnuggetPanel(secondaryColumn);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const secondaryColumn = document.getElementById("secondary");
      if (secondaryColumn && !this.knuggetPanel) {
        console.log("✅ YouTube secondary column found via observer!");
        this.injectKnuggetPanel(secondaryColumn);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "class"],
    });

    let attempts = 0;
    const maxAttempts = 60;

    const periodicCheck = setInterval(() => {
      attempts++;
      const secondaryColumn = document.getElementById("secondary");

      if (secondaryColumn && !this.knuggetPanel) {
        console.log("✅ YouTube secondary column found via periodic check!");
        this.injectKnuggetPanel(secondaryColumn);
        clearInterval(periodicCheck);
        observer.disconnect();
        return;
      }

      if (attempts >= maxAttempts) {
        console.log("⏱️ Max attempts reached, stopping observation");
        clearInterval(periodicCheck);
        observer.disconnect();
      }
    }, 500);
  }

  private injectKnuggetPanel(secondaryColumn: HTMLElement): void {
    if (document.getElementById("knugget-container")) {
      console.log("Knugget panel already exists, skipping injection.");
      return;
    }
    console.log("Knugget AI: Injecting panel with professional styling");

    const panelContainer = document.createElement("div");
    panelContainer.id = "knugget-container";
    panelContainer.className = "knugget-extension";

    panelContainer.innerHTML = `
      <div class="knugget-box">
        <div class="knugget-header">
          <div style="display: flex; align-items: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
              <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="#00a8ff"/>
            </svg>
            <span class="knugget-logo">Knugget</span>
          </div>
          
          <div class="knugget-credits">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 6px;">
              <path d="M20 6H4V18H20V6Z" fill="#00a8ff"/>
            </svg>
            <span id="credits-display">3 Free Credits Left</span>
          </div>
        </div>
        
        <div class="knugget-tabs">
          <button id="transcript-tab" class="knugget-tab knugget-tab-active">
            View Transcript
          </button>
          <button id="summary-tab" class="knugget-tab knugget-tab-inactive">
            View Key Takeaways
          </button>
        </div>
        
        <div class="knugget-content">
          <div id="transcript-content" class="knugget-content-inner">
            <!-- Transcript will be loaded here -->
          </div>
          
          <div id="summary-content" class="knugget-content-inner" style="display: none;">
            <!-- Summary will be loaded here -->
          </div>
        </div>
        
        <div class="knugget-actions">
          <button id="save-btn" class="knugget-save-btn" style="display: none;">Save</button>
          <button id="dashboard-btn" class="knugget-dashboard-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            Dashboard
          </button>
        </div>
      </div>
    `;

    secondaryColumn.insertBefore(panelContainer, secondaryColumn.firstChild);
    this.knuggetPanel = panelContainer;
    this.setupPanelEventListeners();
    this.loadAndDisplayTranscript();
  }

  private setupPanelEventListeners(): void {
    if (!this.knuggetPanel) return;

    const transcriptTab = this.knuggetPanel.querySelector("#transcript-tab");
    const summaryTab = this.knuggetPanel.querySelector("#summary-tab");
    const transcriptContent = this.knuggetPanel.querySelector("#transcript-content");
    const summaryContent = this.knuggetPanel.querySelector("#summary-content");
    const saveButton = this.knuggetPanel.querySelector("#save-btn");

    transcriptTab?.addEventListener("click", () => {
      transcriptTab.classList.remove("knugget-tab-inactive");
      transcriptTab.classList.add("knugget-tab-active");
      summaryTab?.classList.remove("knugget-tab-active");
      summaryTab?.classList.add("knugget-tab-inactive");

      if (transcriptContent) (transcriptContent as HTMLElement).style.display = "block";
      if (summaryContent) (summaryContent as HTMLElement).style.display = "none";
      if (saveButton) (saveButton as HTMLElement).style.display = "none";

      this.loadAndDisplayTranscript();
    });

    summaryTab?.addEventListener("click", () => {
      summaryTab.classList.remove("knugget-tab-inactive");
      summaryTab.classList.add("knugget-tab-active");
      transcriptTab?.classList.remove("knugget-tab-active");
      transcriptTab?.classList.add("knugget-tab-inactive");

      if (summaryContent) (summaryContent as HTMLElement).style.display = "block";
      if (transcriptContent) (transcriptContent as HTMLElement).style.display = "none";
      if (saveButton) (saveButton as HTMLElement).style.display = "block";

      this.loadAndDisplaySummary();
    });

    const dashboardBtn = this.knuggetPanel.querySelector("#dashboard-btn");
    dashboardBtn?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    });
  }

  private async loadAndDisplayTranscript(): Promise<void> {
    const transcriptContent = document.getElementById("transcript-content");
    if (!transcriptContent) return;

    this.showLoading(transcriptContent, "Loading Transcript");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const transcriptResponse = await transcriptService.extractTranscript();

      if (!transcriptResponse.success || !transcriptResponse.data) {
        throw new Error(transcriptResponse.error || "Failed to extract transcript");
      }

      const segments = transcriptResponse.data;
      const segmentsHTML = segments
        .map(
          (segment) => `
        <div class="transcript-segment">
          <span class="knugget-timestamp">${segment.timestamp}</span>
          <span class="knugget-transcript-text">${segment.text}</span>
        </div>
      `
        )
        .join("");

      transcriptContent.innerHTML = `
        <div class="space-y-2 p-2">
          ${segmentsHTML}
        </div>
      `;

      const videoId = getVideoId();
      console.log(`Transcript loaded successfully for video ID: ${videoId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Transcript extraction error:", errorMessage);
      this.showError(transcriptContent, errorMessage, () => this.loadAndDisplayTranscript());
    }
  }

  private async loadAndDisplaySummary(): Promise<void> {
    const summaryContent = document.getElementById("summary-content");
    if (!summaryContent) return;

    if (!this.authState.isAuthenticated) {
      this.showLoginRequired(summaryContent);
      return;
    }

    this.showLoading(summaryContent, "Generating Summary");

    try {
      // Implementation for summary generation would go here
      summaryContent.innerHTML = `
        <div class="summary-placeholder">
          <p>Summary generation will be implemented here</p>
        </div>
      `;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Summary generation error:", errorMessage);
      this.showError(summaryContent, errorMessage, () => this.loadAndDisplaySummary());
    }
  }

  private showLoading(element: HTMLElement, message: string = "Loading"): void {
    element.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 40px;">
        <div class="knugget-spinner" style="margin-bottom: 20px;"></div>
        <p style="color: #ffffff; font-weight: 600;">${message}</p>
        <p style="color: #aaaaaa; font-size: 14px;">Please wait...</p>
      </div>
    `;
  }

  private showError(element: HTMLElement, message: string, retryFn?: () => void): void {
    element.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 40px; text-align: center;">
        <div style="margin-bottom: 20px; color: #ff5757;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p style="color: #ffffff; margin-bottom: 8px;">Error</p>
        <p style="color: #aaaaaa; margin-bottom: 20px;">${message}</p>
        ${retryFn ? '<button id="retry-btn" class="btn btn-primary">Try Again</button>' : ""}
      </div>
    `;

    if (retryFn) {
      const retryBtn = element.querySelector("#retry-btn");
      retryBtn?.addEventListener("click", retryFn);
    }
  }

  private showLoginRequired(element: HTMLElement): void {
    element.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 40px; text-align: center;">
        <div style="margin-bottom: 20px; color: #00a8ff;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <p style="color: #ffffff; margin-bottom: 8px;">Login Required</p>
        <p style="color: #aaaaaa; margin-bottom: 20px;">Please log in to generate summaries</p>
        <button id="login-btn" class="btn btn-primary">Log In</button>
      </div>
    `;

    const loginBtn = element.querySelector("#login-btn");
    loginBtn?.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "OPEN_LOGIN_PAGE",
        payload: { url: window.location.href }
      });
    });
  }

  private setupURLChangeDetection(): void {
    let lastUrl = window.location.href;

    const handleURLChange = debounce(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("🔄 YouTube navigation detected:", currentUrl);

        if (this.isYouTubeWatchPage()) {
          const videoId = getVideoId();
          if (videoId !== this.currentVideoId) {
            console.log(`Navigation to new video detected: ${videoId}`);
            this.processCurrentPage(videoId);
          }
        } else {
          this.cleanup();
        }
      }
    }, 300);

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(handleURLChange, 100);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(handleURLChange, 100);
    };

    window.addEventListener("popstate", handleURLChange);

    document.addEventListener("yt-navigate-finish", () => {
      console.log("YouTube navigation detected via yt-navigate-finish event");
      setTimeout(handleURLChange, 200);
    });

    document.addEventListener("yt-navigate-start", () => {
      console.log("YouTube navigation starting via yt-navigate-start event");
    });

    document.addEventListener("yt-page-data-updated", () => {
      console.log("YouTube page data updated");
      setTimeout(handleURLChange, 100);
    });
  }

  private setupMessageListener(): void {
    console.log('🎧 Setting up YouTube message listener...')
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📨 YouTube content script received message:", {
        type: message.type,
        hasData: !!message.data,
        timestamp: message.timestamp,
      });

      try {
        switch (message.type) {
          case "AUTH_STATUS_CHANGED":
            console.log("🔄 Auth status changed:", message.data);
            this.handleAuthStatusChange(message.data)
            break;

          case "LOGOUT":
            console.log('🚪 User logged out - clearing YouTube extension state')
            this.handleLogout(message.data)
            break;

          case "TEST_CONNECTION":
            console.log('🧪 Test connection received')
            sendResponse({ 
              success: true, 
              contentScriptActive: true,
              currentVideoId: getVideoId(),
              authState: {
                isAuthenticated: this.authState.isAuthenticated,
                hasUser: !!this.authState.user
              }
            })
            break;

          default:
            console.log('❓ Unknown message type:', message.type)
            sendResponse({ success: false, error: 'Unknown message type' })
            return;
        }

        sendResponse({ received: true, processed: true })
      } catch (error: unknown) {
        console.error('❌ Error processing message:', error)
        sendResponse({ 
          received: true, 
          processed: false, 
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
      
      return true
    })

    console.log('✅ YouTube message listener setup complete')
  }

  private handleAuthStatusChange(data: any): void {
    if (data?.isAuthenticated && data?.user) {
      console.log('✅ User authenticated:', data.user.email)
      this.authState.isAuthenticated = true
      this.authState.user = data.user
      this.updateCreditsDisplay(data.user.credits)
      
      // Refresh summary content if it's currently displayed
      const summaryContent = document.getElementById("summary-content");
      if (summaryContent && summaryContent.style.display !== "none") {
        console.log('🔄 Refreshing summary content after auth')
        this.loadAndDisplaySummary();
      }
    } else {
      console.log('❌ User not authenticated')
      this.authState.isAuthenticated = false
      this.authState.user = null
      this.updateCreditsDisplay(0)
      this.refreshUIAfterLogout()
    }
  }

  private handleLogout(data: any): void {
    console.log('🚪 Processing YouTube logout...', data)
    
    // Clear YouTube extension auth state immediately
    this.authState.isAuthenticated = false
    this.authState.user = null
    this.updateCreditsDisplay(0)

    // Force comprehensive UI refresh
    this.refreshUIAfterLogout()
    
    console.log('✅ YouTube logout processing complete')
  }

  private refreshUIAfterLogout(): void {
    console.log('🔄 Refreshing YouTube UI after logout...')
    
    try {
      // Check if summary tab is active and show login required
      const summaryTab = document.querySelector("#summary-tab");
      const summaryContent = document.getElementById("summary-content");
      
      if (summaryTab && summaryTab.classList.contains("knugget-tab-active")) {
        console.log('📋 Summary tab is active, showing login required')
        if (summaryContent) {
          this.showLoginRequired(summaryContent)
        }
      }
      
      // Reset save button
      const saveButton = document.getElementById("save-btn");
      if (saveButton) {
        saveButton.style.display = "none";
      }
      
      // Update credits display
      this.updateCreditsDisplay(0)
      
      console.log('✅ YouTube UI refresh after logout completed')
    } catch (error) {
      console.error('❌ Error during YouTube UI refresh:', error)
    }
  }

  private updateCreditsDisplay(credits: number): void {
    const creditsDisplay = document.getElementById("credits-display");
    if (creditsDisplay) {
      creditsDisplay.textContent = `${credits} Credits Left`;
    }
  }

  private initializeAuthState(): void {
    // Get initial auth state from background
    chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" })
      .then((response) => {
        if (response?.isAuthenticated && response?.user) {
          this.authState.isAuthenticated = true;
          this.authState.user = response.user;
          this.updateCreditsDisplay(response.user.credits || 0);
          console.log("✅ YouTube auth state initialized: Authenticated");
        } else {
          this.authState.isAuthenticated = false;
          this.authState.user = null;
          this.updateCreditsDisplay(0);
          console.log("ℹ️ YouTube auth state initialized: Not authenticated");
        }
      })
      .catch((error) => {
        console.log("❌ Failed to get YouTube auth state:", error);
        this.authState.isAuthenticated = false;
        this.authState.user = null;
        this.updateCreditsDisplay(0);
      });
  }

  private resetContentData(): void {
    console.log("YouTube content data reset for new video");
  }

  private removeExistingPanel(): void {
    const existingPanel = document.getElementById("knugget-container");
    if (existingPanel) {
      existingPanel.remove();
      this.knuggetPanel = null;
    }
  }

  getSiteName(): string {
    return 'youtube';
  }

  cleanup(): void {
    this.removeExistingPanel();
    this.currentVideoId = null;
    console.log("YouTube cleanup completed - navigated away from watch page");
  }
}