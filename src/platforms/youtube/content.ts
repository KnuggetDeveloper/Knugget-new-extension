import "../../styles.css";
import { transcriptService } from "./transcript";
import { youtubeSummaryService } from "./summary";
import { User } from "../../types";
import { getVideoId, getVideoMetadata, debounce } from "../../shared/utils/dom";

let currentVideoId: string | null = null;
let knuggetPanel: HTMLElement | null = null;
let hasInitializedGlobally = false;
let currentSummary: any = null;
let authState = {
  isAuthenticated: false,
  user: null as User | null,
};

function isYouTubeWatchPage(): boolean {
  const pathname = window.location.pathname;
  const search = window.location.search;
  return pathname === "/watch" && search.includes("v=");
}

function initializeKnuggetExtension(): void {
  if (hasInitializedGlobally) {
    console.log("Knugget Extension already initialized, skipping.");
    return;
  }
  hasInitializedGlobally = true;
  console.log("🎯 Knugget Extension initializing...");

  if (!isYouTubeWatchPage()) {
    console.log(
      "Not on YouTube watch page, current URL:",
      window.location.href
    );
  }

  const videoId = getVideoId();
  console.log(`Initializing Knugget AI for video ID: ${videoId}`);

  setupURLChangeDetection();
  setupMessageListener();

  if (videoId) {
    processCurrentPage(videoId);
  }
}

function processCurrentPage(videoId: string | null): void {
  console.log(`Knugget AI: Processing page for video ID ${videoId}`);

  if (currentVideoId !== videoId) {
    currentVideoId = videoId;
    resetContentData();
  }

  chrome.runtime
    .sendMessage({
      type: "PAGE_LOADED",
      payload: { url: window.location.href, videoId },
    })
    .catch(() => {
      // Ignore errors if background script is not ready
    });

  removeExistingPanel();

  setTimeout(() => {
    observeForSecondaryColumn();
  }, 100);

  initializeAuthState();
}

function observeForSecondaryColumn(): void {
  const secondaryColumn = document.getElementById("secondary");
  if (secondaryColumn) {
    console.log("✅ YouTube secondary column found immediately!");
    injectKnuggetPanel(secondaryColumn);
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const secondaryColumn = document.getElementById("secondary");
    if (secondaryColumn && !knuggetPanel) {
      console.log("✅ YouTube secondary column found via observer!");
      injectKnuggetPanel(secondaryColumn);
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

    if (secondaryColumn && !knuggetPanel) {
      console.log("✅ YouTube secondary column found via periodic check!");
      injectKnuggetPanel(secondaryColumn);
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

function injectKnuggetPanel(secondaryColumn: HTMLElement): void {
  if (document.getElementById("knugget-container")) {
    console.log("Knugget panel already exists, skipping injection.");
    return;
  }
  console.log("Knugget AI: Injecting panel with redesigned styling");

  const panelContainer = document.createElement("div");
  panelContainer.id = "knugget-container";
  panelContainer.className = "knugget-extension";

  panelContainer.innerHTML = `
    <div class="knugget-box">
      <!-- Header with Logo and Generate Summary Button -->
      <div class="knugget-header">
        <div class="knugget-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L22 12L12 22L2 12L12 2Z"/>
          </svg>
          Knugget
        </div>
        
        <button id="generate-summary-btn" class="knugget-generate-summary-btn">
          Generate Summary
        </button>
      </div>
      
      <!-- Tab Navigation -->
      <div class="knugget-tabs">
        <button id="transcript-tab" class="knugget-tab knugget-tab-active">
          Transcript
        </button>
        <button id="summary-tab" class="knugget-tab knugget-tab-inactive" style="display: none;">
          Summary
        </button>
      </div>
      
      <!-- Content Area -->
      <div class="knugget-content">
        <!-- Transcript Content -->
        <div id="transcript-content" class="knugget-content-inner">
          <div class="transcript-container">
            <!-- Transcript segments will be loaded here -->
          </div>
        </div>
        
        <!-- Summary Content -->
        <div id="summary-content" class="knugget-content-inner" style="display: none;">
          <!-- Summary content will be loaded here -->
        </div>
      </div>
      
      <!-- Bottom Actions Bar -->
      <div class="knugget-actions">
        <button id="dashboard-btn" class="knugget-view-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          View Knuggets
        </button>
        
        <button id="save-btn" class="knugget-save-btn" style="display: none;">
          Save
        </button>
      </div>
    </div>
  `;

  secondaryColumn.insertBefore(panelContainer, secondaryColumn.firstChild);
  knuggetPanel = panelContainer;
  setupPanelEventListeners();
  loadAndDisplayTranscript();
  // NEW: Check for existing summary on load
  checkForExistingSummaryOnLoad();
}

// NEW: Check for existing summary when panel loads
async function checkForExistingSummaryOnLoad(): Promise<void> {
  // Only check if user is authenticated
  if (!authState.isAuthenticated) {
    console.log("User not authenticated, skipping summary check");
    return;
  }

  const videoId = getVideoId();
  if (!videoId) {
    console.log("No video ID found, skipping summary check");
    return;
  }

  try {
    console.log("Checking for existing summary for video:", videoId);

    const existingResult = await youtubeSummaryService.checkExistingSummary(
      videoId
    );

    if (existingResult.success && existingResult.data) {
      console.log("✅ Found existing summary, revealing Summary tab");

      currentSummary = existingResult.data;

      // Reveal summary tab and show the existing summary
      revealSummaryTab();

      const summaryContent = document.getElementById("summary-content");
      if (summaryContent) {
        displaySummary(summaryContent, currentSummary);
      }

      // Hide the generate button since summary already exists
      const generateButton = document.getElementById("generate-summary-btn");
      if (generateButton) {
        (generateButton as HTMLElement).style.display = "none";
      }
    } else {
      console.log(
        "No existing summary found, keeping Generate Summary button visible"
      );
      // Summary tab remains hidden, Generate Summary button stays visible
    }
  } catch (error) {
    console.error("Error checking for existing summary:", error);
    // Don't show error to user, just keep default state (transcript tab only)
  }
}

function setupPanelEventListeners(): void {
  if (!knuggetPanel) return;

  const transcriptTab = knuggetPanel.querySelector("#transcript-tab");
  const summaryTab = knuggetPanel.querySelector("#summary-tab");
  const transcriptContent = knuggetPanel.querySelector("#transcript-content");
  const summaryContent = knuggetPanel.querySelector("#summary-content");
  const saveButton = knuggetPanel.querySelector("#save-btn");
  const generateButton = knuggetPanel.querySelector("#generate-summary-btn");

  // Transcript tab click
  transcriptTab?.addEventListener("click", () => {
    transcriptTab.classList.remove("knugget-tab-inactive");
    transcriptTab.classList.add("knugget-tab-active");
    summaryTab?.classList.remove("knugget-tab-active");
    summaryTab?.classList.add("knugget-tab-inactive");

    if (transcriptContent)
      (transcriptContent as HTMLElement).style.display = "block";
    if (summaryContent) (summaryContent as HTMLElement).style.display = "none";
    if (saveButton) (saveButton as HTMLElement).style.display = "none";

    loadAndDisplayTranscript();
  });

  // Summary tab click (only works if tab is visible)
  summaryTab?.addEventListener("click", () => {
    // Only switch if summary tab is visible
    if ((summaryTab as HTMLElement).style.display !== "none") {
      summaryTab.classList.remove("knugget-tab-inactive");
      summaryTab.classList.add("knugget-tab-active");
      transcriptTab?.classList.remove("knugget-tab-active");
      transcriptTab?.classList.add("knugget-tab-inactive");

      if (summaryContent)
        (summaryContent as HTMLElement).style.display = "block";
      if (transcriptContent)
        (transcriptContent as HTMLElement).style.display = "none";
      if (saveButton) (saveButton as HTMLElement).style.display = "block";

      // Don't reload summary if it already exists
      if (currentSummary) {
        displaySummary(summaryContent as HTMLElement, currentSummary);
      }
    }
  });

  // Dashboard/View Knuggets button
  const dashboardBtn = knuggetPanel.querySelector("#dashboard-btn");
  dashboardBtn?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
  });

  // Generate Summary button - main logic for progressive tab visibility
  generateButton?.addEventListener("click", async () => {
    if (!authState.isAuthenticated) {
      console.log("User not authenticated, opening login page");
      chrome.runtime.sendMessage({
        type: "OPEN_LOGIN_PAGE",
        payload: { url: window.location.href },
      });
      return;
    }

    // User is authenticated, proceed with summary generation
    await generateAndShowSummary();
  });

  // Save button event listener
  saveButton?.addEventListener("click", async () => {
    if (!currentSummary) {
      console.error("No summary to save");
      return;
    }

    const button = saveButton as HTMLButtonElement;
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Saving...";

    try {
      const saveResult = await youtubeSummaryService.saveSummary(
        currentSummary
      );

      if (saveResult.success) {
        currentSummary = saveResult.data;
        button.textContent = "Saved!";
        setTimeout(() => {
          button.textContent = "Save";
          button.disabled = false;
        }, 2000);
      } else {
        throw new Error(saveResult.error || "Failed to save summary");
      }
    } catch (error) {
      console.error("Failed to save summary:", error);
      button.textContent = "Save Failed";
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }
  });
}

// NEW: Function to handle summary generation and immediate tab reveal
async function generateAndShowSummary(): Promise<void> {
  const summaryContent = document.getElementById("summary-content");
  const summaryTab = document.getElementById("summary-tab");
  const generateButton = document.getElementById("generate-summary-btn");

  if (!summaryContent || !summaryTab || !generateButton) return;

  // IMMEDIATELY reveal summary tab and switch to it with loading message
  revealSummaryTab();
  showLoading(summaryContent, "Summarising transcript for key takeaways…");

  // Update generate button to show loading state
  const originalButtonText = generateButton.textContent;
  (generateButton as HTMLButtonElement).disabled = true;
  generateButton.textContent = "Generating...";

  try {
    const videoId = getVideoId();
    if (!videoId) {
      throw new Error("No video ID found");
    }

    // Get transcript
    const transcriptResponse = await transcriptService.extractTranscript();
    if (!transcriptResponse.success || !transcriptResponse.data) {
      throw new Error(
        transcriptResponse.error || "Failed to extract transcript"
      );
    }

    // Get video metadata
    const videoMetadata = getVideoMetadata();
    if (!videoMetadata) {
      throw new Error("Failed to extract video metadata");
    }

    // Generate summary
    const summaryRequest = {
      transcript: transcriptResponse.data,
      videoMetadata,
    };

    const summaryResult = await youtubeSummaryService.generateSummary(
      summaryRequest
    );

    if (!summaryResult.success || !summaryResult.data) {
      throw new Error(summaryResult.error || "Failed to generate summary");
    }

    currentSummary = summaryResult.data;

    // SUCCESS: Display the generated summary
    displaySummary(summaryContent, currentSummary);

    // Hide generate button since summary now exists
    (generateButton as HTMLElement).style.display = "none";

    console.log("✅ Summary generated successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Summary generation error:", errorMessage);

    // Show error in summary content (tab is already revealed)
    showError(summaryContent, errorMessage, generateAndShowSummary);

    // Reset generate button on error
    (generateButton as HTMLButtonElement).disabled = false;
    generateButton.textContent = originalButtonText;
  }
}

// NEW: Function to reveal and activate summary tab
function revealSummaryTab(): void {
  const summaryTab = document.getElementById("summary-tab");
  const transcriptTab = document.getElementById("transcript-tab");
  const summaryContent = document.getElementById("summary-content");
  const transcriptContent = document.getElementById("transcript-content");
  const saveButton = document.getElementById("save-btn");

  if (
    !summaryTab ||
    !transcriptTab ||
    !summaryContent ||
    !transcriptContent ||
    !saveButton
  )
    return;

  // Make summary tab visible
  (summaryTab as HTMLElement).style.display = "block";

  // Switch to summary tab
  summaryTab.classList.remove("knugget-tab-inactive");
  summaryTab.classList.add("knugget-tab-active");
  transcriptTab.classList.remove("knugget-tab-active");
  transcriptTab.classList.add("knugget-tab-inactive");

  // Show summary content and hide transcript
  (summaryContent as HTMLElement).style.display = "block";
  (transcriptContent as HTMLElement).style.display = "none";

  // Show save button
  (saveButton as HTMLElement).style.display = "block";

  console.log("✅ Summary tab revealed and activated");
}

function displaySummary(element: HTMLElement, summary: any): void {
  const saveButtonDisplay = summary.saved ? "none" : "block";
  const saveButtonText = summary.saved ? "Saved" : "Save";

  element.innerHTML = `
    <div class="summary-container">
      <div class="summary-header">
        <h3 class="summary-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Key Takeaways
        </h3>
      </div>
      
      <div class="key-points">
        ${summary.keyPoints
          .map(
            (point: string) => `
          <div class="key-point">
            <span class="key-point-bullet">●</span>
            <span class="key-point-text">${point}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  // Update save button visibility
  const saveButton = document.getElementById("save-btn") as HTMLButtonElement;
  if (saveButton) {
    saveButton.style.display = saveButtonDisplay;
    saveButton.textContent = saveButtonText;
    saveButton.disabled = summary.saved;
  }
}

async function loadAndDisplayTranscript(): Promise<void> {
  const transcriptContent = document.getElementById("transcript-content");
  if (!transcriptContent) return;

  showLoading(transcriptContent, "Loading Transcript");

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const transcriptResponse = await transcriptService.extractTranscript();

    if (!transcriptResponse.success || !transcriptResponse.data) {
      throw new Error(
        transcriptResponse.error || "Failed to extract transcript"
      );
    }

    const segments = transcriptResponse.data;
    const segmentsHTML = segments
      .map(
        (segment: any) => `
        <div class="transcript-segment">
          <span class="knugget-timestamp">${segment.timestamp}</span>
          <span class="knugget-transcript-text">${segment.text}</span>
        </div>
      `
      )
      .join("");

    transcriptContent.innerHTML = `
      <div class="transcript-container">
        ${segmentsHTML}
      </div>
    `;

    const videoId = getVideoId();
    console.log(`Transcript loaded successfully for video ID: ${videoId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Transcript extraction error:", errorMessage);
    showError(transcriptContent, errorMessage, loadAndDisplayTranscript);
  }
}

function showLoading(element: HTMLElement, message: string = "Loading"): void {
  element.innerHTML = `
    <div class="knugget-loading">
      <div class="knugget-spinner"></div>
      <h3>${message}</h3>
      <p>Please wait...</p>
    </div>
  `;
}

function showError(
  element: HTMLElement,
  message: string,
  retryFn?: () => void
): void {
  element.innerHTML = `
    <div class="knugget-error">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h3>Error</h3>
      <p>${message}</p>
      ${
        retryFn
          ? '<button class="knugget-login-btn" id="retry-btn">Try Again</button>'
          : ""
      }
    </div>
  `;

  if (retryFn) {
    const retryBtn = element.querySelector("#retry-btn");
    retryBtn?.addEventListener("click", retryFn);
  }
}

function showLoginRequired(element: HTMLElement): void {
  element.innerHTML = `
    <div class="knugget-login-required">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <h3>Login Required</h3>
      <p>Please log in to generate summaries</p>
      <button class="knugget-login-btn" id="login-btn">Log In</button>
    </div>
  `;

  const loginBtn = element.querySelector("#login-btn");
  loginBtn?.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_LOGIN_PAGE",
      payload: { url: window.location.href },
    });
  });
}

function setupURLChangeDetection(): void {
  let lastUrl = window.location.href;

  const handleURLChange = debounce(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("🔄 YouTube navigation detected:", currentUrl);

      if (isYouTubeWatchPage()) {
        const videoId = getVideoId();
        if (videoId !== currentVideoId) {
          console.log(`Navigation to new video detected: ${videoId}`);
          processCurrentPage(videoId);
        }
      } else {
        cleanup();
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

// Enhanced message listener for auth sync
function setupMessageListener(): void {
  console.log("🎧 Setting up message listener...");

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("📨 Content script received message:", {
      type: message.type,
      hasData: !!message.data,
      timestamp: message.timestamp,
    });

    try {
      switch (message.type) {
        case "AUTH_STATUS_CHANGED":
          console.log("🔄 Auth status changed:", message.data);
          handleAuthStatusChange(message.data);
          break;

        case "LOGOUT":
          console.log("🚪 User logged out - clearing extension state");
          handleLogout(message.data);
          break;

        case "TEST_CONNECTION":
          console.log("🧪 Test connection received");
          sendResponse({
            success: true,
            contentScriptActive: true,
            currentVideoId: getVideoId(),
            authState: {
              isAuthenticated: authState.isAuthenticated,
              hasUser: !!authState.user,
            },
          });
          break;

        default:
          console.log("❓ Unknown message type:", message.type);
          sendResponse({ success: false, error: "Unknown message type" });
          return;
      }

      sendResponse({ received: true, processed: true });
    } catch (error: unknown) {
      console.error("❌ Error processing message:", error);
      sendResponse({
        received: true,
        processed: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }

    return true;
  });

  console.log("✅ Message listener setup complete");
}

function handleAuthStatusChange(data: any): void {
  if (data?.isAuthenticated && data?.user) {
    console.log("✅ User authenticated:", data.user.email);
    authState.isAuthenticated = true;
    authState.user = data.user;
    updateCreditsDisplay(data.user.credits);

    // Refresh summary content if it's currently displayed
    const summaryContent = document.getElementById("summary-content");
    if (summaryContent && summaryContent.style.display !== "none") {
      console.log("🔄 Refreshing summary content after auth");
      generateAndShowSummary();
    }
  } else {
    console.log("❌ User not authenticated");
    authState.isAuthenticated = false;
    authState.user = null;
    updateCreditsDisplay(0);
    refreshUIAfterLogout();
  }
}

function handleLogout(data: any): void {
  console.log("🚪 Processing logout...", data);

  // Clear extension auth state immediately
  authState.isAuthenticated = false;
  authState.user = null;
  currentSummary = null; // Clear current summary
  updateCreditsDisplay(0);

  // Force comprehensive UI refresh
  refreshUIAfterLogout();

  // Show logout notification to user
  showLogoutNotification();

  console.log("✅ Logout processing complete");
}

function refreshUIAfterLogout(): void {
  console.log("🔄 Refreshing UI after logout...");

  try {
    // Check if summary tab is active and show login required
    const summaryTab = document.querySelector("#summary-tab");
    const summaryContent = document.getElementById("summary-content");

    if (summaryTab && summaryTab.classList.contains("knugget-tab-active")) {
      console.log("📋 Summary tab is active, showing login required");
      if (summaryContent) {
        showLoginRequired(summaryContent);
      }
    }

    // Reset save button
    const saveButton = document.getElementById("save-btn");
    if (saveButton) {
      saveButton.style.display = "none";
    }

    // Update credits display
    updateCreditsDisplay(0);

    console.log("✅ UI refresh after logout completed");
  } catch (error) {
    console.error("❌ Error during UI refresh:", error);
  }
}

function showLogoutNotification(): void {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1f2937;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: opacity 0.3s ease;
  `;
  notification.textContent = "✅ Logged out successfully";

  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function updateCreditsDisplay(credits: number): void {
  const creditsDisplay = document.getElementById("credits-display");
  if (creditsDisplay) {
    creditsDisplay.textContent = `${credits} Credits Left`;
  }
}

function initializeAuthState(): void {
  // Get initial auth state from background
  chrome.runtime
    .sendMessage({ type: "CHECK_AUTH_STATUS" })
    .then((response) => {
      if (response?.isAuthenticated && response?.user) {
        authState.isAuthenticated = true;
        authState.user = response.user;
        updateCreditsDisplay(response.user.credits || 0);
        console.log("✅ Auth state initialized: Authenticated");
      } else {
        authState.isAuthenticated = false;
        authState.user = null;
        updateCreditsDisplay(0);
        console.log("ℹ️ Auth state initialized: Not authenticated");
      }
    })
    .catch((error) => {
      console.log("❌ Failed to get auth state:", error);
      authState.isAuthenticated = false;
      authState.user = null;
      updateCreditsDisplay(0);
    });
}

function resetContentData(): void {
  console.log("Content data reset for new video");
  currentSummary = null; // Reset summary when navigating to new video
}

function removeExistingPanel(): void {
  const existingPanel = document.getElementById("knugget-container");
  if (existingPanel) {
    existingPanel.remove();
    knuggetPanel = null;
  }
}

function cleanup(): void {
  removeExistingPanel();
  currentVideoId = null;
  currentSummary = null;
  console.log("Cleanup completed - navigated away from watch page");
}

function initializeWhenReady(): void {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    console.log("DOM ready, initializing immediately");
    initializeKnuggetExtension();
    return;
  }

  if (window.location.hostname.includes("youtube.com")) {
    const checkYouTubeReady = () => {
      if (hasInitializedGlobally) {
        console.log("YouTube specific check: Already initialized globally.");
        return;
      }
      if (
        document.querySelector("#secondary") ||
        document.querySelector("ytd-app")
      ) {
        console.log("YouTube app detected, initializing");
        initializeKnuggetExtension();
      } else {
        setTimeout(checkYouTubeReady, 500);
      }
    };

    if (document.readyState === "loading") {
      setTimeout(checkYouTubeReady, 100);
    }
  }
}

console.log("Knugget content script loaded and ready");
initializeWhenReady();
