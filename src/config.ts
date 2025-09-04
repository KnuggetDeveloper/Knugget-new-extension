
import { KnuggetConfig, Platform } from "./types";

export const config: KnuggetConfig = {
  apiBaseUrl: "http://localhost:3000/api",
  websiteUrl: "http://localhost:8000",
  refreshTokenThreshold: 5,
  maxRetries: 3,
  retryDelay: 1000,
  
  platforms: {
    [Platform.YOUTUBE]: {
      name: "YouTube",
      selectors: {
        // YouTube DOM selectors
        secondaryColumn: "#secondary",
        videoTitle: "h1.ytd-watch-metadata #title, h1.title, #container h1, ytd-watch-metadata h1",
        channelName: "#top-row .ytd-channel-name a, #channel-name a, #owner-name a, ytd-channel-name a",
        transcriptButton: 'button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]',
        transcriptSegments: "ytd-transcript-segment-renderer, .segment, .ytd-transcript-segment-renderer",
        expandButton: "tp-yt-paper-button#expand, .more-button, #expand",
        moreButton: "#top-level-buttons-computed ytd-menu-renderer, ytd-menu-renderer",
      },
      features: ["transcript", "summary", "save", "credits"]
    },
    
    [Platform.LINKEDIN]: {
      name: "LinkedIn",
      selectors: {
        // LinkedIn DOM selectors
        feedContainer: ".scaffold-layout__main, .feed-container, main",
        postContainers: '[data-urn*="urn:li:activity"], .feed-shared-update-v2, .occludable-update',
        postContent: '.feed-shared-text .break-words, .update-components-text .break-words',
        postAuthor: '.update-components-actor__name, .feed-shared-actor__name',
        postUrl: 'a[data-control-name="timestamp"], a[href*="/posts/"], a[href*="/activity-"]',
        socialActionBar: '.feed-shared-social-action-bar, .update-components-footer, .social-actions-bar',
      },
      features: ["save", "credits", "engagement"]
    },

    [Platform.WEBSITE]: {
      name: "Website",
      selectors: {
        // Website content selectors
        articleContainer: "article, [role='article'], .post, .entry, .content, .article, .blog-post",
        titleSelectors: "h1, [data-testid='storyTitle'], .crayons-story__title, .post-title, .entry-title, .article-title",
        contentSelectors: "article, [role='article'], .post-content, .entry-content, .article-content, .story-content, .crayons-article__main",
        authorSelectors: ".author, .byline, .post-author, .entry-author, .article-author",
        dateSelectors: ".date, .published, .post-date, .entry-date, .article-date",
        tagsSelectors: ".tags, .post-tags, .entry-tags, .article-tags",
      },
      features: ["summary", "save", "credits", "extraction"]
    }
  }
};

export const selectors = {
  // YouTube selectors (for backward compatibility)
  youtube: config.platforms[Platform.YOUTUBE].selectors,
  
  // LinkedIn selectors
  linkedin: config.platforms[Platform.LINKEDIN].selectors,
  
  // Website selectors
  website: config.platforms[Platform.WEBSITE].selectors,
  
  // Extension UI selectors (universal)
  knugget: {
    container: "#knugget-panel",
    tabTranscript: "#knugget-tab-transcript",
    tabSummary: "#knugget-tab-summary",
    tabContent: "#knugget-tab-content", // NEW: For website content tab
    contentTranscript: "#knugget-content-transcript",
    contentSummary: "#knugget-content-summary",
    contentPreview: "#knugget-content-preview", // NEW: For website content preview
    loginButton: "#knugget-login-btn",
    generateButton: "#knugget-generate-btn",
    saveButton: "#knugget-save-btn",
  },
};

export const storageKeys = {
  AUTH_DATA: "knugget_auth",
  USER_PREFERENCES: "knugget_preferences",
  CACHED_SUMMARIES: "knugget_summaries_cache",
  CACHED_WEBSITE_SUMMARIES: "knugget_website_summaries_cache", // NEW: Website summaries cache
  SAVED_POSTS: "knugget_saved_posts",
  SAVED_WEBSITES: "knugget_saved_websites", // NEW: Saved website content
  LAST_SYNC: "knugget_last_sync",
  PLATFORM_STATE: "knugget_platform_state",
};

export const events = {
  AUTH_CHANGED: "knugget:auth:changed",
  VIDEO_CHANGED: "knugget:video:changed",
  POST_DETECTED: "knugget:post:detected",
  WEBSITE_DETECTED: "knugget:website:detected", // NEW: Website content detected
  TRANSCRIPT_READY: "knugget:transcript:ready",
  SUMMARY_READY: "knugget:summary:ready",
  WEBSITE_SUMMARY_READY: "knugget:website:summary:ready", // NEW: Website summary ready
  CONTENT_SAVED: "knugget:content:saved",
  ERROR: "knugget:error",
} as const;

// NEW: Excluded website domains (where extension should NOT activate)
export const EXCLUDED_WEBSITE_DOMAINS = [
  'youtube.com',
  'linkedin.com',
  'google.com',
  'gmail.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'github.com',
  'stackoverflow.com',
  'amazon.com',
  'ebay.com',
  'paypal.com',
  'netflix.com',
  'spotify.com',
  'apple.com',
  'microsoft.com',
  'zoom.us',
  'slack.com',
  'discord.com',
  'whatsapp.com',
  'telegram.org',
  'dropbox.com',
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'figma.com',
  'canva.com',
  'trello.com',
  'asana.com',
  'notion.so',
  'airtable.com',
  'mailchimp.com',
  'stripe.com',
  'paddle.com',
  'gumroad.com'
];

// NEW: Website content extraction patterns
export const WEBSITE_PATTERNS = {
  // Common article selectors by priority
  articleSelectors: [
    'article',
    '[role="article"]',
    '.post',
    '.entry',
    '.content',
    '.article',
    '.blog-post',
    '.post-content',
    '.entry-content',
    '.article-content'
  ],
  
  // Title selectors by priority
  titleSelectors: [
    'h1',
    '[data-testid="storyTitle"]', // Medium
    '.crayons-story__title', // Dev.to
    '.post-title',
    '.entry-title',
    '.article-title',
    '.blog-title',
    'header h1',
    'article h1',
    'title'
  ],
  
  // Content selectors by priority
  contentSelectors: [
    'article',
    '[role="article"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.blog-content',
    '.content',
    '.story-content', // Medium
    '.crayons-article__main', // Dev.to
    'main',
    '.main-content'
  ],
  
  // Skip these selectors (navigation, ads, etc.)
  skipSelectors: [
    'nav',
    'header',
    'footer',
    '.navigation',
    '.nav',
    '.menu',
    '.sidebar',
    '.ads',
    '.advertisement',
    '.social-share',
    '.comments',
    '.related-posts',
    '.author-bio',
    '.newsletter-signup'
  ]
};