// src/platforms/website/content.ts - Universal Website Content Support
import "../../styles.css";
import { websiteContentService } from "./content-service";
import { User } from "../../types";
import { debounce } from "../../shared/utils/dom";

let knuggetPanel: HTMLElement | null = null;
let hasInitializedGlobally = false;
let currentSummary: any = null;
let currentWebsiteData: any = null;
let authState = {
  isAuthenticated: false,
  user: null as User | null,
};

// Excluded domains (sites where the extension shouldn't activate)
const EXCLUDED_DOMAINS = [
  "youtube.com",
  "linkedin.com",
  "google.com",
  "gmail.com",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "github.com",
  "stackoverflow.com",
  "amazon.com",
  "ebay.com",
  "paypal.com",
  "netflix.com",
  "spotify.com",
  "apple.com",
  "microsoft.com",
  "zoom.us",
  "slack.com",
  "discord.com",
  "whatsapp.com",
  "telegram.org",
  "dropbox.com",
  "drive.google.com",
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
  "figma.com",
  "canva.com",
  "trello.com",
  "asana.com",
  "notion.so",
  "airtable.com",
  "mailchimp.com",
  "stripe.com",
  "paddle.com",
  "gumroad.com",
];

function isSupportedWebsite(): boolean {
  const hostname = window.location.hostname.toLowerCase();

  // Skip excluded domains
  if (EXCLUDED_DOMAINS.some((domain) => hostname.includes(domain))) {
    return false;
  }

  // Skip localhost and IP addresses
  if (
    hostname.includes("localhost") ||
    hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
  ) {
    return false;
  }

  // Allow all other domains
  return true;
}

function isArticlePage(): boolean {
  // Check if current page looks like an article/blog post
  const pathname = window.location.pathname;
  const url = window.location.href;

  // Skip obvious non-article pages
  if (
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/feed" ||
    pathname === "/blog" ||
    pathname === "/articles" ||
    pathname === "/news" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup" ||
    pathname === "/search" ||
    pathname === "/category" ||
    pathname === "/categories" ||
    pathname === "/tag" ||
    pathname === "/tags" ||
    pathname === "/archive" ||
    pathname === "/sitemap" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".pdf") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".svg")
  ) {
    return false;
  }

  // Check for article indicators in URL
  const articleUrlPatterns = [
    /\/post\//,
    /\/article\//,
    /\/blog\//,
    /\/story\//,
    /\/read\//,
    /\/news\//,
    /\/tutorial\//,
    /\/guide\//,
    /\/how-to\//,
    /\/\d{4}\/\d{2}\//, // Date patterns like /2024/01/
    /\/p\//, // Medium-style
    /\/articles\//, // Dev.to style
  ];

  const hasArticlePattern = articleUrlPatterns.some((pattern) =>
    pattern.test(pathname)
  );

  // Look for article indicators in DOM
  const hasArticleContent = checkForArticleContent();

  // Look for article schema markup
  const hasArticleSchema = checkForArticleSchema();

  // Check for minimum content length and structure
  const hasMinimumContent = checkForMinimumContent();

  // Must have either URL pattern OR (article content AND minimum content)
  return (
    hasArticlePattern ||
    ((hasArticleContent || hasArticleSchema) && hasMinimumContent)
  );
}

function checkForArticleContent(): boolean {
  const articleSelectors = [
    "article",
    '[role="article"]',
    ".post",
    ".entry",
    ".content",
    ".article",
    ".blog-post",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".story-content",
    ".main-content",
    "main article",
    ".container article",
    ".wrapper article",
  ];

  for (const selector of articleSelectors) {
    const element = document.querySelector(selector);
    if (
      element &&
      element.textContent &&
      element.textContent.trim().length > 300
    ) {
      return true;
    }
  }
  return false;
}

function checkForArticleSchema(): boolean {
  // Check for JSON-LD schema markup
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  for (const script of Array.from(jsonLdScripts)) {
    try {
      const data = JSON.parse(script.textContent || "");
      if (
        data["@type"] === "Article" ||
        data["@type"] === "BlogPosting" ||
        data["@type"] === "NewsArticle"
      ) {
        return true;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Check for microdata
  const articleMicrodata = document.querySelector('[itemtype*="Article"]');
  if (articleMicrodata) {
    return true;
  }

  // Check for Open Graph article type
  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType && ogType.getAttribute("content") === "article") {
    return true;
  }

  return false;
}

function checkForMinimumContent(): boolean {
  // Check if page has meaningful content
  const bodyText = document.body.innerText || document.body.textContent || "";

  // Must have at least 500 characters of text
  if (bodyText.trim().length < 500) {
    return false;
  }

  // Check for typical article elements
  const hasHeadings =
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").length > 0;
  const hasParagraphs = document.querySelectorAll("p").length > 3;
  const hasReadableContent = bodyText.split(" ").length > 100; // At least 100 words

  return hasHeadings && hasParagraphs && hasReadableContent;
}

function initializeKnuggetExtension(): void {
  if (hasInitializedGlobally) {
    console.log("Knugget Extension already initialized, skipping.");
    return;
  }
  hasInitializedGlobally = true;
  console.log("🎯 Knugget Extension initializing for website...");

  if (!isSupportedWebsite() || !isArticlePage()) {
    console.log(
      "Not on supported website article page, current URL:",
      window.location.href
    );
    return;
  }

  setupMessageListener();
  initializeAuthState();

  // Wait for page to be fully loaded before extracting content
  if (document.readyState === "complete") {
    processCurrentPage();
  } else {
    window.addEventListener("load", processCurrentPage);
  }
}

function processCurrentPage(): void {
  console.log(`Knugget AI: Processing website page - ${window.location.href}`);

  chrome.runtime
    .sendMessage({
      type: "PAGE_LOADED",
      payload: { url: window.location.href, platform: "website" },
    })
    .catch(() => {
      // Ignore errors if background script is not ready
    });

  removeExistingPanel();

  setTimeout(() => {
    injectKnuggetPanel();
  }, 100);
}

function injectKnuggetPanel(): void {
  if (document.getElementById("knugget-container")) {
    console.log("Knugget panel already exists, skipping injection.");
    return;
  }

  // Find best location to inject panel
  const targetElement = findBestInjectionLocation();
  if (!targetElement) {
    console.log("Could not find suitable location for panel injection");
    return;
  }

  console.log("Knugget AI: Injecting panel for website content");

  const panelContainer = document.createElement("div");
  panelContainer.id = "knugget-container";
  panelContainer.className = "knugget-extension fixed-panel";
  panelContainer.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 10000 !important;
    max-width: 400px !important;
    width: 100% !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5) !important;
  `;

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
        <button id="content-tab" class="knugget-tab knugget-tab-active">
          Content
        </button>
        <button id="summary-tab" class="knugget-tab knugget-tab-inactive" style="display: none;">
          Summary
        </button>
      </div>
      
      <!-- Content Area -->
      <div class="knugget-content">
        <!-- Content Preview -->
        <div id="content-preview" class="knugget-content-inner">
          <div class="website-content-container">
            <!-- Website content preview will be loaded here -->
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

  document.body.appendChild(panelContainer);
  knuggetPanel = panelContainer;
  setupPanelEventListeners();
  loadAndDisplayContent();
  checkForExistingSummaryOnLoad();
}

function findBestInjectionLocation(): Element | null {
  // Try to find the best location to inject the panel
  const candidates = [document.body, document.documentElement];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function checkForExistingSummaryOnLoad(): Promise<void> {
  if (!authState.isAuthenticated) {
    console.log("User not authenticated, skipping summary check");
    return;
  }

  const url = window.location.href;
  if (!url) {
    console.log("No URL found, skipping summary check");
    return;
  }

  try {
    console.log("Checking for existing summary for URL:", url);

    const existingResult = await websiteContentService.checkExistingSummary(
      url
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
    }
  } catch (error) {
    console.error("Error checking for existing summary:", error);
  }
}

function setupPanelEventListeners(): void {
  if (!knuggetPanel) return;

  const contentTab = knuggetPanel.querySelector("#content-tab");
  const summaryTab = knuggetPanel.querySelector("#summary-tab");
  const contentPreview = knuggetPanel.querySelector("#content-preview");
  const summaryContent = knuggetPanel.querySelector("#summary-content");
  const saveButton = knuggetPanel.querySelector("#save-btn");
  const generateButton = knuggetPanel.querySelector("#generate-summary-btn");

  // Content tab click
  contentTab?.addEventListener("click", () => {
    contentTab.classList.remove("knugget-tab-inactive");
    contentTab.classList.add("knugget-tab-active");
    summaryTab?.classList.remove("knugget-tab-active");
    summaryTab?.classList.add("knugget-tab-inactive");

    if (contentPreview) (contentPreview as HTMLElement).style.display = "block";
    if (summaryContent) (summaryContent as HTMLElement).style.display = "none";
    if (saveButton) (saveButton as HTMLElement).style.display = "none";

    loadAndDisplayContent();
  });

  // Summary tab click
  summaryTab?.addEventListener("click", () => {
    if ((summaryTab as HTMLElement).style.display !== "none") {
      summaryTab.classList.remove("knugget-tab-inactive");
      summaryTab.classList.add("knugget-tab-active");
      contentTab?.classList.remove("knugget-tab-active");
      contentTab?.classList.add("knugget-tab-inactive");

      if (summaryContent)
        (summaryContent as HTMLElement).style.display = "block";
      if (contentPreview)
        (contentPreview as HTMLElement).style.display = "none";
      if (saveButton) (saveButton as HTMLElement).style.display = "block";

      if (currentSummary) {
        displaySummary(summaryContent as HTMLElement, currentSummary);
      }
    }
  });

  // Dashboard button
  const dashboardBtn = knuggetPanel.querySelector("#dashboard-btn");
  dashboardBtn?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
  });

  // Generate Summary button
  generateButton?.addEventListener("click", async () => {
    if (!authState.isAuthenticated) {
      console.log("User not authenticated, opening login page");
      chrome.runtime.sendMessage({
        type: "OPEN_LOGIN_PAGE",
        payload: { url: window.location.href },
      });
      return;
    }

    await generateAndShowSummary();
  });

  // Save button
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
      const saveResult = await websiteContentService.saveSummary(
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

async function generateAndShowSummary(): Promise<void> {
  const summaryContent = document.getElementById("summary-content");
  const summaryTab = document.getElementById("summary-tab");
  const generateButton = document.getElementById("generate-summary-btn");

  if (!summaryContent || !summaryTab || !generateButton) return;

  // Reveal summary tab and switch to it with loading message
  revealSummaryTab();
  showLoading(summaryContent, "Analyzing article content...");

  // Update generate button to show loading state
  const originalButtonText = generateButton.textContent;
  (generateButton as HTMLButtonElement).disabled = true;
  generateButton.textContent = "Generating...";

  try {
    // Extract website content
    const websiteData = extractWebsiteContent();
    if (!websiteData) {
      throw new Error("Failed to extract website content");
    }

    currentWebsiteData = websiteData;

    // Generate summary
    const summaryResult = await websiteContentService.generateSummary(
      websiteData
    );

    if (!summaryResult.success || !summaryResult.data) {
      throw new Error(summaryResult.error || "Failed to generate summary");
    }

    currentSummary = summaryResult.data;

    // Display the generated summary
    displaySummary(summaryContent, currentSummary);

    // Hide generate button since summary now exists
    (generateButton as HTMLElement).style.display = "none";

    console.log("✅ Summary generated successfully");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Summary generation error:", errorMessage);

    // Show error in summary content
    showError(summaryContent, errorMessage, generateAndShowSummary);

    // Reset generate button on error
    (generateButton as HTMLButtonElement).disabled = false;
    generateButton.textContent = originalButtonText;
  }
}

function revealSummaryTab(): void {
  const summaryTab = document.getElementById("summary-tab");
  const contentTab = document.getElementById("content-tab");
  const summaryContent = document.getElementById("summary-content");
  const contentPreview = document.getElementById("content-preview");
  const saveButton = document.getElementById("save-btn");

  if (
    !summaryTab ||
    !contentTab ||
    !summaryContent ||
    !contentPreview ||
    !saveButton
  )
    return;

  // Make summary tab visible
  (summaryTab as HTMLElement).style.display = "block";

  // Switch to summary tab
  summaryTab.classList.remove("knugget-tab-inactive");
  summaryTab.classList.add("knugget-tab-active");
  contentTab.classList.remove("knugget-tab-active");
  contentTab.classList.add("knugget-tab-inactive");

  // Show summary content and hide content preview
  (summaryContent as HTMLElement).style.display = "block";
  (contentPreview as HTMLElement).style.display = "none";

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

function loadAndDisplayContent(): void {
  const contentPreview = document.getElementById("content-preview");
  if (!contentPreview) return;

  try {
    const websiteData = extractWebsiteContent();

    if (!websiteData) {
      showError(contentPreview, "Could not extract content from this page");
      return;
    }

    const truncatedContent =
      websiteData.content.length > 1000
        ? websiteData.content.substring(0, 1000) + "..."
        : websiteData.content;

    contentPreview.innerHTML = `
      <div class="website-content-container">
        <div class="content-meta">
          <h3 class="content-title">${websiteData.title}</h3>
          <div class="content-source">
            <span class="content-website">${websiteData.websiteName}</span>
            <span class="content-url">${websiteData.url}</span>
          </div>
        </div>
        
        <div class="content-preview">
          <div class="content-text">
            ${truncatedContent
              .split("\n")
              .map((paragraph: string) =>
                paragraph.trim() ? `<p>${paragraph}</p>` : ""
              )
              .join("")}
          </div>
        </div>
      </div>
    `;

    console.log("✅ Content preview loaded successfully");
  } catch (error) {
    console.error("Content preview error:", error);
    showError(contentPreview, "Failed to load content preview");
  }
}

function extractWebsiteContent(): any {
  const url = window.location.href;
  const hostname = window.location.hostname;

  // Enhanced website name cleaning
  const websiteName = cleanWebsiteName(hostname);

  // Extract title with multiple strategies
  const title = extractTitle();

  // Extract content with enhanced methods
  const content = extractContent();

  // Extract additional metadata
  const metadata = extractMetadata();

  // Validate extracted content
  if (!content || content.length < 100) {
    return null;
  }

  if (!title || title.length < 5) {
    return null;
  }

  return {
    title,
    content,
    url,
    websiteName,
    metadata,
  };
}

function cleanWebsiteName(hostname: string): string {
  return hostname
    .replace(/^www\./, "")
    .replace(/^blog\./, "")
    .replace(/^news\./, "")
    .replace(/^article\./, "")
    .replace(/^post\./, "")
    .replace(
      /\.(com|org|net|io|co|edu|gov|mil|int|info|biz|name|pro|museum)$/,
      ""
    )
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

function extractTitle(): string {
  // Try multiple strategies to extract title
  const titleStrategies = [
    // Strategy 1: Semantic HTML and schema markup
    () => {
      const h1Elements = document.querySelectorAll("h1");
      if (h1Elements.length === 1) {
        return h1Elements[0].textContent?.trim() || "";
      }
      return "";
    },

    // Strategy 2: Platform-specific selectors
    () => {
      const platformSelectors = [
        '[data-testid="storyTitle"]', // Medium
        ".crayons-story__title", // Dev.to
        ".post-title",
        ".entry-title",
        ".article-title",
        ".blog-title",
        ".story-title",
        ".content-title",
        "header h1",
        "article h1",
        "main h1",
        ".title",
        ".headline",
      ];

      for (const selector of platformSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      return "";
    },

    // Strategy 3: JSON-LD schema
    () => {
      const jsonLdScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const script of Array.from(jsonLdScripts)) {
        try {
          const data = JSON.parse(script.textContent || "");
          if (data.headline) return data.headline;
          if (data.name) return data.name;
        } catch (e) {
          // Continue to next script
        }
      }
      return "";
    },

    // Strategy 4: Open Graph meta tags
    () => {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        return ogTitle.getAttribute("content") || "";
      }
      return "";
    },

    // Strategy 5: Twitter meta tags
    () => {
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle) {
        return twitterTitle.getAttribute("content") || "";
      }
      return "";
    },

    // Strategy 6: Document title (cleaned)
    () => {
      const docTitle = document.title;
      if (docTitle) {
        // Remove site name from title
        const separators = [" - ", " | ", " :: ", " • ", " · ", " — ", " – "];
        for (const sep of separators) {
          if (docTitle.includes(sep)) {
            const parts = docTitle.split(sep);
            return parts[0].trim();
          }
        }
        return docTitle;
      }
      return "";
    },
  ];

  // Try each strategy until we find a good title
  for (const strategy of titleStrategies) {
    const title = strategy();
    if (title && title.length > 5 && title.length < 200) {
      return title;
    }
  }

  return "Untitled Article";
}

function extractContent(): string {
  // Enhanced content extraction with multiple strategies
  const contentStrategies = [
    // Strategy 1: Semantic article elements
    () => {
      const article = document.querySelector("article");
      if (article) {
        return extractTextFromElement(article);
      }
      return "";
    },

    // Strategy 2: Role-based selection
    () => {
      const articleRole = document.querySelector('[role="article"]');
      if (articleRole) {
        return extractTextFromElement(articleRole);
      }
      return "";
    },

    // Strategy 3: Common content selectors
    () => {
      const contentSelectors = [
        ".post-content",
        ".entry-content",
        ".article-content",
        ".blog-content",
        ".story-content",
        ".content-body",
        ".post-body",
        ".entry-body",
        ".article-body",
        ".main-content",
        ".primary-content",
        ".page-content",
        ".content-area",
        ".content-wrapper",
        ".content-container",
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const content = extractTextFromElement(element);
          if (content.length > 200) {
            return content;
          }
        }
      }
      return "";
    },

    // Strategy 4: Platform-specific selectors
    () => {
      const platformSelectors = [
        ".crayons-article__main", // Dev.to
        ".story-content", // Medium
        ".post-content", // WordPress
        ".entry-content", // WordPress
        ".article-content", // Generic
        ".content", // Generic
        "main", // Semantic HTML
        ".main", // Class-based main
        "#main", // ID-based main
        ".container .content",
        ".wrapper .content",
        ".site-content",
        ".page-content",
      ];

      for (const selector of platformSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const content = extractTextFromElement(element);
          if (content.length > 200) {
            return content;
          }
        }
      }
      return "";
    },

    // Strategy 5: Largest content block
    () => {
      const contentElements = document.querySelectorAll(
        "div, section, article, main"
      );
      let longestContent = "";

      for (const element of Array.from(contentElements)) {
        const content = extractTextFromElement(element);
        if (content.length > longestContent.length && content.length > 200) {
          longestContent = content;
        }
      }

      return longestContent;
    },

    // Strategy 6: Fallback to body (filtered)
    () => {
      return extractTextFromElement(document.body, true);
    },
  ];

  // Try each strategy until we find good content
  for (const strategy of contentStrategies) {
    const content = strategy();
    if (content && content.length > 200) {
      return cleanContent(content);
    }
  }

  return "";
}

function extractTextFromElement(
  element: Element,
  isBodyFallback: boolean = false
): string {
  if (!element) return "";

  // Clone element to avoid modifying original
  const clone = element.cloneNode(true) as Element;

  // Remove unwanted elements
  const unwantedSelectors = [
    "script",
    "style",
    "nav",
    "header",
    "footer",
    "aside",
    ".navigation",
    ".nav",
    ".menu",
    ".sidebar",
    ".widget",
    ".ads",
    ".ad",
    ".advertisement",
    ".social-share",
    ".share",
    ".comments",
    ".comment",
    ".related",
    ".related-posts",
    ".author-bio",
    ".bio",
    ".newsletter",
    ".subscription",
    ".popup",
    ".modal",
    ".overlay",
    ".banner",
    ".alert",
    ".notification",
    ".breadcrumb",
    ".pagination",
    ".pager",
    ".tags",
    ".categories",
    ".metadata",
    ".byline",
    ".timestamp",
    ".date",
    ".reading-time",
    ".share-button",
    ".social-button",
    ".follow-button",
    ".subscribe-button",
    ".cta",
    ".call-to-action",
    ".promo",
    ".promotion",
    ".signup",
    ".form",
    ".search",
    ".filter",
    ".toolbar",
    ".controls",
    ".player",
    ".video-player",
    ".audio-player",
    ".embed",
    ".iframe",
    ".code",
    ".highlight",
    ".syntax",
  ];

  if (isBodyFallback) {
    // For body fallback, be more aggressive in removing unwanted content
    unwantedSelectors.push(
      "header",
      "nav",
      "footer",
      "aside",
      ".header",
      ".footer",
      ".navigation",
      ".sidebar",
      ".menu",
      ".widget",
      ".ads",
      ".social",
      ".comments",
      ".related"
    );
  }

  unwantedSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  // Extract text preserving paragraph structure
  const text = (clone as HTMLElement).innerText || clone.textContent || "";

  return text.trim();
}

function cleanContent(content: string): string {
  return (
    content
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Fix paragraph breaks
      .replace(/\n\s*\n/g, "\n")
      // Remove excessive newlines
      .replace(/\n{3,}/g, "\n\n")
      // Remove leading/trailing whitespace
      .trim()
  );
}

function extractMetadata(): any {
  const metadata: any = {};

  // Extract author
  const authorSelectors = [
    '[rel="author"]',
    ".author",
    ".byline",
    ".post-author",
    ".entry-author",
    ".article-author",
    ".writer",
    ".creator",
    '[itemprop="author"]',
    'meta[name="author"]',
    'meta[property="article:author"]',
  ];

  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.author =
        element.textContent?.trim() || element.getAttribute("content") || "";
      if (metadata.author) break;
    }
  }

  // Extract publish date
  const dateSelectors = [
    "time[datetime]",
    '[itemprop="datePublished"]',
    ".date",
    ".published",
    ".post-date",
    ".entry-date",
    ".article-date",
    'meta[property="article:published_time"]',
    'meta[name="date"]',
  ];

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.publishDate =
        element.getAttribute("datetime") ||
        element.getAttribute("content") ||
        element.textContent?.trim() ||
        "";
      if (metadata.publishDate) break;
    }
  }

  // Extract tags/categories
  const tagSelectors = [
    ".tags a",
    ".categories a",
    ".tag",
    ".category",
    '[rel="tag"]',
    '[itemprop="keywords"]',
    'meta[name="keywords"]',
    'meta[property="article:tag"]',
  ];

  const tags: string[] = [];
  for (const selector of tagSelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      const tag =
        element.textContent?.trim() || element.getAttribute("content") || "";
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });
    if (tags.length > 0) break;
  }
  metadata.tags = tags;

  // Extract reading time
  const readingTimeSelectors = [
    ".reading-time",
    ".read-time",
    ".eta",
    "[data-reading-time]",
    ".post-reading-time",
    ".article-reading-time",
  ];

  for (const selector of readingTimeSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.readingTime =
        element.textContent?.trim() ||
        element.getAttribute("data-reading-time") ||
        "";
      if (metadata.readingTime) break;
    }
  }

  // Extract description/excerpt
  const descriptionSelectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    ".excerpt",
    ".summary",
    ".description",
    ".lead",
    ".intro",
  ];

  for (const selector of descriptionSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      metadata.description =
        element.getAttribute("content") || element.textContent?.trim() || "";
      if (metadata.description) break;
    }
  }

  return metadata;
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

function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("📨 Website content script received message:", message.type);

    try {
      switch (message.type) {
        case "AUTH_STATUS_CHANGED":
          console.log("🔄 Website: Auth status changed:", message.data);
          handleAuthStatusChange(message.data);
          break;

        case "LOGOUT":
          console.log("🚪 Website: User logged out");
          handleLogout(message.data);
          break;

        case "TEST_CONNECTION":
          console.log("🧪 Website: Test connection received");
          sendResponse({
            success: true,
            contentScriptActive: true,
            platform: "website",
            authState: {
              isAuthenticated: authState.isAuthenticated,
              hasUser: !!authState.user,
            },
          });
          break;

        default:
          console.log("❓ Website: Unknown message type:", message.type);
          sendResponse({ success: false, error: "Unknown message type" });
          return;
      }

      sendResponse({ received: true, processed: true });
    } catch (error: unknown) {
      console.error("❌ Website: Error processing message:", error);
      sendResponse({
        received: true,
        processed: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }

    return true;
  });
}

function handleAuthStatusChange(data: any): void {
  if (data?.isAuthenticated && data?.user) {
    console.log("✅ Website: User authenticated:", data.user.email);
    authState.isAuthenticated = true;
    authState.user = data.user;

    // Refresh summary content if displayed
    const summaryContent = document.getElementById("summary-content");
    if (summaryContent && summaryContent.style.display !== "none") {
      console.log("🔄 Refreshing summary content after auth");
      generateAndShowSummary();
    }
  } else {
    console.log("❌ Website: User not authenticated");
    authState.isAuthenticated = false;
    authState.user = null;
    refreshUIAfterLogout();
  }
}

function handleLogout(data: any): void {
  console.log("🚪 Website: Processing logout...", data);

  authState.isAuthenticated = false;
  authState.user = null;
  currentSummary = null;

  refreshUIAfterLogout();
  console.log("✅ Website: Logout processing complete");
}

function refreshUIAfterLogout(): void {
  console.log("🔄 Website: Refreshing UI after logout...");

  try {
    const summaryTab = document.querySelector("#summary-tab");
    const summaryContent = document.getElementById("summary-content");

    if (summaryTab && summaryTab.classList.contains("knugget-tab-active")) {
      if (summaryContent) {
        showLoginRequired(summaryContent);
      }
    }

    const saveButton = document.getElementById("save-btn");
    if (saveButton) {
      saveButton.style.display = "none";
    }

    console.log("✅ Website: UI refresh after logout completed");
  } catch (error) {
    console.error("❌ Website: Error during UI refresh:", error);
  }
}

function initializeAuthState(): void {
  chrome.runtime
    .sendMessage({ type: "CHECK_AUTH_STATUS" })
    .then((response) => {
      if (response?.isAuthenticated && response?.user) {
        authState.isAuthenticated = true;
        authState.user = response.user;
        console.log("✅ Website: Auth state initialized: Authenticated");
      } else {
        authState.isAuthenticated = false;
        authState.user = null;
        console.log("ℹ️ Website: Auth state initialized: Not authenticated");
      }
    })
    .catch((error) => {
      console.log("❌ Website: Failed to get auth state:", error);
      authState.isAuthenticated = false;
      authState.user = null;
    });
}

function removeExistingPanel(): void {
  const existingPanel = document.getElementById("knugget-container");
  if (existingPanel) {
    existingPanel.remove();
    knuggetPanel = null;
  }
}

function initializeWhenReady(): void {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    console.log("DOM ready, initializing website extension");
    initializeKnuggetExtension();
    return;
  }

  if (isSupportedWebsite()) {
    const checkReady = () => {
      if (hasInitializedGlobally) return;

      if (document.readyState === "complete" || isArticlePage()) {
        console.log("Website ready, initializing");
        initializeKnuggetExtension();
      } else {
        setTimeout(checkReady, 500);
      }
    };

    if (document.readyState === "loading") {
      setTimeout(checkReady, 100);
    } else {
      checkReady();
    }
  }
}

console.log("Knugget website content script loaded");
initializeWhenReady();
