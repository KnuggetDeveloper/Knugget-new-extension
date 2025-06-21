// Enhanced src/platforms/linkedin/content.ts - Integrated with centralized auth
import "../../styles.css";
import { config } from "../../config";

// Authentication state management
let authState = {
  isAuthenticated: false,
  user: null as any | null,
};

// Function to detect and remove duplicated content within a string
function removeDuplicatedContent(text: string): string {
  if (!text || text.length < 5) return text;

  console.log("Checking for duplicated content in:", text);

  const halfLength = Math.floor(text.length / 2);
  if (
    text.length % 2 === 0 &&
    text.substring(0, halfLength) === text.substring(halfLength)
  ) {
    const cleanText = text.substring(0, halfLength);
    console.log("Found exact repetition, cleaned to:", cleanText);
    return cleanText;
  }

  const words = text.split(/\s+/);
  const wordCount = words.length;
  if (wordCount >= 4 && wordCount % 2 === 0) {
    const firstHalf = words.slice(0, wordCount / 2).join(" ");
    const secondHalf = words.slice(wordCount / 2).join(" ");
    if (firstHalf === secondHalf) {
      console.log("Found word repetition, cleaned to:", firstHalf);
      return firstHalf;
    }
  }

  for (let i = 3; i < text.length / 2; i++) {
    for (let offset = 0; offset < 5 && offset + i < text.length / 2; offset++) {
      const pattern = text.substring(offset, offset + i);
      if (pattern.length < 3) continue;

      const regex = new RegExp(`(${escapeRegExp(pattern)}){2,}`, "g");
      const matches = text.match(regex);

      if (matches && matches.length > 0) {
        for (const match of matches) {
          if (match.length > pattern.length * 1.5) {
            const cleanText = text.replace(match, pattern);
            console.log(
              `Found pattern repetition "${pattern}", cleaned from "${match}" to:`,
              cleanText
            );
            return cleanText;
          }
        }
      }
    }
  }

  const nameMatch = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)(?:\1)$/);
  if (nameMatch && nameMatch[1]) {
    console.log("Found name repetition, cleaned to:", nameMatch[1]);
    return nameMatch[1];
  }

  return text;
}

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Function to extract post data from LinkedIn page
function extractPostData() {
  const postData = {
    author_name: "",
    author_about: "",
    author_image_url: null as string | null,
    content: "",
    link: window.location.href,
  };

  // Try to find the most visible/active post on the page
  const posts = document.querySelectorAll(
    ".fie-impression-container, .feed-shared-update-v2"
  );

  if (posts.length === 0) {
    return null;
  }

  // Use the first post found (most relevant for current view)
  const post = posts[0];

  // Extract author information
  const authorContainer = post.querySelector(
    ".update-components-actor__container"
  );
  if (authorContainer) {
    // Extract author name
    const authorNameElement = authorContainer.querySelector(
      '.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]'
    );
    if (authorNameElement) {
      const nameText = authorNameElement.textContent;
      if (nameText) {
        const nameMatch = nameText.match(/<!---->([^<>]+)<!---->/);
        if (nameMatch && nameMatch[1]) {
          postData.author_name = nameMatch[1].trim();
        } else {
          postData.author_name = nameText.replace(/<!---->/g, "").trim();
        }
        console.log("Raw author name:", nameText);
        console.log("Cleaned author name:", postData.author_name);
      }
    }

    // Extract author about/description
    const authorAboutElement = authorContainer.querySelector(
      '.update-components-actor__description span[aria-hidden="true"]'
    );
    if (authorAboutElement) {
      const aboutText = authorAboutElement.textContent;
      if (aboutText) {
        const aboutMatch = aboutText.match(/<!---->([^<>]+)<!---->/);
        if (aboutMatch && aboutMatch[1]) {
          postData.author_about = aboutMatch[1].trim();
        } else {
          postData.author_about = aboutText.replace(/<!---->/g, "").trim();
        }
        console.log("Raw author about:", aboutText);
        console.log("Cleaned author about:", postData.author_about);
      }
    }

    // Extract author profile image
    const authorImageElement = authorContainer.querySelector(
      ".js-update-components-actor__avatar img, .update-components-actor__avatar-image"
    ) as HTMLImageElement;
    if (authorImageElement && authorImageElement.hasAttribute("src")) {
      postData.author_image_url = authorImageElement.getAttribute("src");
      console.log("Extracted author image URL:", postData.author_image_url);
    } else {
      // Try broader selector
      const anyImageElement = post.querySelector(
        '.update-components-actor__container img[src*="licdn.com"]'
      ) as HTMLImageElement;
      if (anyImageElement) {
        postData.author_image_url = anyImageElement.getAttribute("src");
        console.log(
          "Extracted author image URL (broad selector):",
          postData.author_image_url
        );
      }
    }
  }

  // Extract post content
  const contentElement = post.querySelector(
    ".feed-shared-inline-show-more-text.feed-shared-update-v2__description, .feed-shared-text"
  );
  if (contentElement && contentElement.textContent) {
    // Clean up LinkedIn's specific formatting and extra whitespace
    let content = contentElement.textContent.trim();
    
    // Remove LinkedIn's "...more" and other UI elements
    content = content.replace(/\s*…more\s*$/i, '');
    content = content.replace(/\s*\.\.\.more\s*$/i, '');
    
    // Clean up excessive whitespace and newlines
    content = content.replace(/\s+/g, ' ').trim();
    
    // Remove any remaining HTML-like artifacts
    content = content.replace(/\s*\n\s*/g, '\n').trim();
    
    postData.content = content;
  }

  // Extract post URN to create direct link
  const postContainer = post.closest(".feed-shared-update-v2[data-urn]");
  if (postContainer) {
    const urn = postContainer.getAttribute("data-urn");
    if (urn) {
      postData.link = `https://www.linkedin.com/feed/update/${urn}`;
      console.log("Extracted post URN:", urn);
      console.log("Generated link:", postData.link);
    }
  }

  // If we couldn't find the URN, try other methods
  if (postData.link === window.location.href) {
    console.log("Trying alternative methods to find post URN");
    const updateElements = [
      ...Array.from(post.querySelectorAll("[data-urn]")),
      ...Array.from(
        document.querySelectorAll(".feed-shared-update-v2[data-urn]")
      ),
    ];

    for (const element of updateElements) {
      const urn = element.getAttribute("data-urn");
      if (urn && urn.includes("activity:")) {
        postData.link = `https://www.linkedin.com/feed/update/${urn}`;
        console.log("Found URN from alternative element:", urn);
        console.log("Generated link:", postData.link);
        break;
      }
    }
  }

  // Clean up duplicated content
  postData.author_name = removeDuplicatedContent(postData.author_name);
  postData.author_about = removeDuplicatedContent(postData.author_about);
  postData.content = removeDuplicatedContent(postData.content);

  return postData;
}

// Function to get post content for popup
function getPostContentForPopup() {
  try {
    const postData = extractPostData();

    if (!postData || (!postData.author_name && !postData.content)) {
      return {
        success: false,
        error:
          "No post content found on this page. Make sure you are viewing a LinkedIn post.",
      };
    }

    return {
      success: true,
      postData: postData,
    };
  } catch (error) {
    console.error("Error extracting post content:", error);
    return {
      success: false,
      error:
        "Error extracting post content: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

// NEW: Save LinkedIn post to backend via background script
async function savePostToBackend(postData: any): Promise<boolean> {
  try {
    if (!authState.isAuthenticated) {
      console.error("User not authenticated");
      return false;
    }

    // Prepare LinkedIn post data for backend
    const linkedinPostPayload = {
      title: postData.content.substring(0, 100) + (postData.content.length > 100 ? "..." : ""),
      content: postData.content,
      author: postData.author_name || "Unknown Author",
      postUrl: postData.link,
      platform: "linkedin",
      metadata: {
        authorAbout: postData.author_about,
        authorImage: postData.author_image_url,
        timestamp: new Date().toISOString(),
        source: "chrome_extension"
      }
    };

    console.log("Saving LinkedIn post to backend:", linkedinPostPayload);

    // Send to background script to make the API call
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_LINKEDIN_POST",
      payload: linkedinPostPayload
    });

    if (response?.success) {
      console.log("LinkedIn post saved successfully:", response.data);
      return true;
    } else {
      console.error("Backend save failed:", response?.error || "Unknown error");
      return false;
    }

  } catch (error) {
    console.error("Error saving LinkedIn post:", error);
    return false;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "ping") {
    // Simple ping to check if content script is loaded
    sendResponse({ success: true, message: "Content script loaded" });
    return true;
  }

  if (request.action === "getPostContent") {
    const result = getPostContentForPopup();
    sendResponse(result);
    return true;
  }

  if (request.action === "getSelectedPost") {
    // Get the stored selected post data
    chrome.storage.local.get(["selectedPost"], function (result) {
      if (result.selectedPost) {
        sendResponse({
          success: true,
          postData: result.selectedPost,
        });
      } else {
        sendResponse({
          success: false,
          error:
            'No post selected. Click a "Save to Knugget" button next to any LinkedIn post first.',
        });
      }
    });
    return true;
  }
});

// NEW: Message listener for auth state changes (same as YouTube)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 LinkedIn content script received message:", message.type);

  try {
    switch (message.type) {
      case "AUTH_STATUS_CHANGED":
        console.log("🔄 LinkedIn: Auth status changed:", message.data);
        handleAuthStatusChange(message.data);
        break;

      case "LOGOUT":
        console.log('🚪 LinkedIn: User logged out - updating button states');
        handleLogout(message.data);
        break;

      case "TEST_CONNECTION":
        console.log('🧪 LinkedIn: Test connection received');
        sendResponse({ 
          success: true, 
          contentScriptActive: true,
          platform: 'linkedin',
          authState: {
            isAuthenticated: authState.isAuthenticated,
            hasUser: !!authState.user
          }
        });
        break;

      default:
        console.log('❓ LinkedIn: Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
        return;
    }

    sendResponse({ received: true, processed: true });
  } catch (error: unknown) {
    console.error('❌ LinkedIn: Error processing message:', error);
    sendResponse({ 
      received: true, 
      processed: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
  
  return true;
});

// NEW: Handle auth status changes
function handleAuthStatusChange(data: any): void {
  if (data?.isAuthenticated && data?.user) {
    console.log('✅ LinkedIn: User authenticated:', data.user.email);
    authState.isAuthenticated = true;
    authState.user = data.user;
    
    // Update all existing buttons to enabled state
    updateAllButtonStates(true);
  } else {
    console.log('❌ LinkedIn: User not authenticated');
    authState.isAuthenticated = false;
    authState.user = null;
    
    // Update all existing buttons to disabled state
    updateAllButtonStates(false);
  }
}

// NEW: Handle logout
function handleLogout(data: any): void {
  console.log('🚪 LinkedIn: Processing logout...', data);
  
  authState.isAuthenticated = false;
  authState.user = null;
  
  // Update all buttons to disabled state
  updateAllButtonStates(false);
  
  console.log('✅ LinkedIn: Logout processing complete');
}

// NEW: Update all button states based on auth
function updateAllButtonStates(isAuthenticated: boolean): void {
  const buttons = document.querySelectorAll('.linkedin-post-saver-button');
  
  buttons.forEach((button) => {
    const btn = button as HTMLButtonElement;
    if (isAuthenticated) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.title = 'Save this post to Knugget';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.title = 'Please log in to save posts';
    }
  });
  
  console.log(`Updated ${buttons.length} LinkedIn buttons - authenticated: ${isAuthenticated}`);
}

// Function to create and add save buttons to LinkedIn posts
function addSaveButtonsToLinkedInPosts() {
  console.log("Looking for LinkedIn posts...");

  // Try multiple selectors for LinkedIn posts (LinkedIn changes their classes frequently)
  const postSelectors = [
    ".fie-impression-container",
    ".feed-shared-update-v2",
    ".feed-shared-update-v2__content",
    ".update-v2-social-activity",
    ".scaffold-layout__content .feed-shared-update-v2",
    ".feed-container-theme .feed-shared-update-v2",
  ];

  let posts: Element[] = [];

  // Try each selector until we find posts
  for (const selector of postSelectors) {
    posts = Array.from(document.querySelectorAll(selector));
    console.log(`Selector "${selector}" found ${posts.length} posts`);
    if (posts.length > 0) {
      break;
    }
  }

  if (posts.length === 0) {
    console.log("No posts found with any selector. Trying broader search...");
    // Fallback: look for any element with feed update classes
    posts = Array.from(
      document.querySelectorAll('[data-urn*="activity"], [data-urn*="ugcPost"]')
    );
    console.log(`Fallback search found ${posts.length} elements with data-urn`);
  }

  console.log(`Processing ${posts.length} posts...`);

  posts.forEach((post, index) => {
    console.log(`Processing post ${index + 1}:`, post);

    // Check if this post already has our save button
    if (post.querySelector(".linkedin-post-saver-button")) {
      console.log(`Post ${index + 1} already has button, skipping`);
      return;
    }

    // Create the save button with updated label
    const saveButton = document.createElement("button");
    saveButton.className = "linkedin-post-saver-button";
    saveButton.innerHTML = "<span>Save to Knugget</span>"; // CHANGED: Updated button label
    saveButton.title = "Save this post to Knugget";

    // Set initial button state based on auth
    if (!authState.isAuthenticated) {
      saveButton.disabled = true;
      saveButton.style.opacity = '0.5';
      saveButton.title = 'Please log in to save posts';
    }

    // Add click event listener to the button
    saveButton.addEventListener("click", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      console.log("Save to Knugget button clicked for post:", post);

      // Check auth state
      if (!authState.isAuthenticated) {
        console.log("User not authenticated, showing login prompt");
        saveButton.innerHTML = "<span>Please Login</span>";
        
        // Open login page
        chrome.runtime.sendMessage({
          type: "OPEN_LOGIN_PAGE",
          payload: { url: window.location.href }
        });
        
        setTimeout(() => {
          saveButton.innerHTML = "<span>Save to Knugget</span>";
        }, 2000);
        return;
      }

      // Update button state
      saveButton.innerHTML = "<span>Saving...</span>";
      saveButton.disabled = true;

      try {
        // Extract post data from this specific post
        const postData = extractSpecificPostData(post);

        // Clean up any duplicated content
        postData.author_name = removeDuplicatedContent(postData.author_name);
        postData.author_about = removeDuplicatedContent(postData.author_about);
        postData.content = removeDuplicatedContent(postData.content);

        console.log("Extracted and cleaned post data:", postData);

        // NEW: Save to backend instead of just storing locally
        const saveSuccess = await savePostToBackend(postData);

        if (saveSuccess) {
          // Store the selected post data for popup display (keeping existing functionality)
          chrome.storage.local.set({ selectedPost: postData }, function () {
            console.log("Post data stored for popup display");
          });

          // Show success feedback
          saveButton.innerHTML = "<span>Saved!</span>";
          setTimeout(() => {
            saveButton.innerHTML = "<span>Save to Knugget</span>";
            saveButton.disabled = false;
          }, 2000);
        } else {
          throw new Error("Failed to save to backend");
        }

      } catch (error) {
        console.error("Failed to save post:", error);
        saveButton.innerHTML = "<span>Save Failed</span>";
        setTimeout(() => {
          saveButton.innerHTML = "<span>Save to Knugget</span>";
          saveButton.disabled = false;
        }, 2000);
      }
    });

    // Try multiple selectors for the control menu where we want to place the button
    const controlMenuSelectors = [
      ".feed-shared-control-menu",
      ".social-actions-bar",
      ".feed-shared-social-action-bar",
      ".feed-shared-actions-bar",
      ".social-action-bar",
      ".feed-shared-footer",
    ];

    let controlMenu = null;
    for (const selector of controlMenuSelectors) {
      controlMenu = post.querySelector(selector);
      if (controlMenu) {
        console.log(`Found control menu with selector: ${selector}`);
        break;
      }
    }

    if (controlMenu) {
      controlMenu.appendChild(saveButton);
      console.log(`Button added to post ${index + 1} successfully`);
    } else {
      console.log(
        `No control menu found for post ${
          index + 1
        }, trying to add to post directly`
      );

      // Fallback: try to add at the end of the post
      const fallbackLocations = [
        post.querySelector(".feed-shared-update-v2__content"),
        post.querySelector(".feed-shared-text"),
        post,
      ];

      for (const location of fallbackLocations) {
        if (location) {
          const buttonContainer = document.createElement("div");
          buttonContainer.style.padding = "8px";
          buttonContainer.style.textAlign = "right";
          buttonContainer.appendChild(saveButton);
          location.appendChild(buttonContainer);
          console.log(
            `Button added to fallback location for post ${index + 1}`
          );
          break;
        }
      }
    }
  });

  console.log(`Finished processing posts. Total processed: ${posts.length}`);
}

// Function to extract post data from a specific post element
function extractSpecificPostData(post: Element) {
  const postData = {
    author_name: "",
    author_about: "",
    author_image_url: null as string | null,
    content: "",
    link: window.location.href,
  };

  // Extract author information from this specific post
  const authorContainer = post.querySelector(
    ".update-components-actor__container"
  );
  if (authorContainer) {
    // Extract author name
    const authorNameElement = authorContainer.querySelector(
      '.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]'
    );
    if (authorNameElement) {
      const nameText = authorNameElement.textContent;
      if (nameText) {
        const nameMatch = nameText.match(/<!---->([^<>]+)<!---->/);
        if (nameMatch && nameMatch[1]) {
          postData.author_name = nameMatch[1].trim();
        } else {
          postData.author_name = nameText.replace(/<!---->/g, "").trim();
        }
        console.log("Raw author name:", nameText);
        console.log("Cleaned author name:", postData.author_name);
      }
    }

    // Extract author about/description
    const authorAboutElement = authorContainer.querySelector(
      '.update-components-actor__description span[aria-hidden="true"]'
    );
    if (authorAboutElement) {
      const aboutText = authorAboutElement.textContent;
      if (aboutText) {
        const aboutMatch = aboutText.match(/<!---->([^<>]+)<!---->/);
        if (aboutMatch && aboutMatch[1]) {
          postData.author_about = aboutMatch[1].trim();
        } else {
          postData.author_about = aboutText.replace(/<!---->/g, "").trim();
        }
        console.log("Raw author about:", aboutText);
        console.log("Cleaned author about:", postData.author_about);
      }
    }

    // Extract author profile image
    const authorImageElement = authorContainer.querySelector(
      ".js-update-components-actor__avatar img, .update-components-actor__avatar-image"
    ) as HTMLImageElement;
    if (authorImageElement && authorImageElement.hasAttribute("src")) {
      postData.author_image_url = authorImageElement.getAttribute("src");
      console.log("Extracted author image URL:", postData.author_image_url);
    } else {
      // Try broader selector
      const anyImageElement = post.querySelector(
        '.update-components-actor__container img[src*="licdn.com"]'
      ) as HTMLImageElement;
      if (anyImageElement) {
        postData.author_image_url = anyImageElement.getAttribute("src");
        console.log(
          "Extracted author image URL (broad selector):",
          postData.author_image_url
        );
      }
    }
  }

  // Extract post content from this specific post
  const contentElement = post.querySelector(
    ".feed-shared-inline-show-more-text.feed-shared-update-v2__description, .feed-shared-text"
  );
  if (contentElement && contentElement.textContent) {
    // Clean up LinkedIn's specific formatting and extra whitespace
    let content = contentElement.textContent.trim();
    
    // Remove LinkedIn's "...more" and other UI elements
    content = content.replace(/\s*…more\s*$/i, '');
    content = content.replace(/\s*\.\.\.more\s*$/i, '');
    
    // Clean up excessive whitespace and newlines
    content = content.replace(/\s+/g, ' ').trim();
    
    // Remove any remaining HTML-like artifacts
    content = content.replace(/\s*\n\s*/g, '\n').trim();
    
    postData.content = content;
  }

  // Extract post URN to create direct link from this specific post
  const postContainer = post.closest(".feed-shared-update-v2[data-urn]");
  if (postContainer) {
    const urn = postContainer.getAttribute("data-urn");
    if (urn) {
      postData.link = `https://www.linkedin.com/feed/update/${urn}`;
      console.log("Extracted post URN:", urn);
      console.log("Generated link:", postData.link);
    }
  }

  // If we couldn't find the URN from this post, try other methods within this post
  if (postData.link === window.location.href) {
    console.log(
      "Trying alternative methods to find post URN for this specific post"
    );
    const updateElements = Array.from(post.querySelectorAll("[data-urn]"));

    for (const element of updateElements) {
      const urn = element.getAttribute("data-urn");
      if (urn && urn.includes("activity:")) {
        postData.link = `https://www.linkedin.com/feed/update/${urn}`;
        console.log("Found URN from alternative element:", urn);
        console.log("Generated link:", postData.link);
        break;
      }
    }
  }

  return postData;
}

// NEW: Initialize auth state when content script loads
async function initializeAuthState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" });
    
    if (response?.isAuthenticated && response?.user) {
      authState.isAuthenticated = true;
      authState.user = response.user;
      console.log("✅ LinkedIn: Auth state initialized - authenticated");
    } else {
      authState.isAuthenticated = false;
      authState.user = null;
      console.log("ℹ️ LinkedIn: Auth state initialized - not authenticated");
    }
  } catch (error) {
    console.log("❌ LinkedIn: Failed to get auth state:", error);
    authState.isAuthenticated = false;
    authState.user = null;
  }
}

// Initialize when page loads with better debugging
async function init() {
  console.log(
    "LinkedIn Post Saver extension initialized on:",
    window.location.href
  );
  console.log("Document ready state:", document.readyState);

  // NEW: Initialize auth state first
  await initializeAuthState();

  // Immediate first attempt
  console.log("Immediate attempt to add buttons...");
  addSaveButtonsToLinkedInPosts();

  // Delayed attempts to catch dynamically loaded content
  setTimeout(() => {
    console.log("First delayed attempt (2s)...");
    addSaveButtonsToLinkedInPosts();
  }, 2000);

  setTimeout(() => {
    console.log("Second delayed attempt (5s)...");
    addSaveButtonsToLinkedInPosts();
  }, 5000);

  // Set up MutationObserver to handle dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        // Check if any new nodes contain posts
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            const element = node as Element;
            const isPost =
              element.matches &&
              (element.matches(".feed-shared-update-v2") ||
                element.matches(".fie-impression-container") ||
                (element.querySelector &&
                  (element.querySelector(".feed-shared-update-v2") ||
                    element.querySelector(".fie-impression-container"))));
            if (isPost) {
              shouldCheck = true;
            }
          }
        });
      }
    });

    if (shouldCheck) {
      console.log("MutationObserver detected new posts, adding buttons...");
      addSaveButtonsToLinkedInPosts();
    }
  });

  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });

  console.log("MutationObserver set up successfully");
}

// Initialize when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}