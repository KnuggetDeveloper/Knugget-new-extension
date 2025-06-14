import { KnuggetConfig, Platform } from "./types";

export const config: KnuggetConfig = {
  apiBaseUrl: "https://knugget-new-backend.onrender.com/api",
  websiteUrl: "https://knugget-new-client.vercel.app",
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
    }
  }
};

export const selectors = {
  // YouTube selectors (for backward compatibility)
  youtube: config.platforms[Platform.YOUTUBE].selectors,
  
  // LinkedIn selectors
  linkedin: config.platforms[Platform.LINKEDIN].selectors,
  
  // Extension UI selectors (universal)
  knugget: {
    container: "#knugget-panel",
    tabTranscript: "#knugget-tab-transcript",
    tabSummary: "#knugget-tab-summary",
    contentTranscript: "#knugget-content-transcript",
    contentSummary: "#knugget-content-summary",
    loginButton: "#knugget-login-btn",
    generateButton: "#knugget-generate-btn",
    saveButton: "#knugget-save-btn",
  },
};

export const storageKeys = {
  AUTH_DATA: "knugget_auth",
  USER_PREFERENCES: "knugget_preferences",
  CACHED_SUMMARIES: "knugget_summaries_cache",
  SAVED_POSTS: "knugget_saved_posts",
  LAST_SYNC: "knugget_last_sync",
  PLATFORM_STATE: "knugget_platform_state",
};

export const events = {
  AUTH_CHANGED: "knugget:auth:changed",
  VIDEO_CHANGED: "knugget:video:changed",
  POST_DETECTED: "knugget:post:detected",
  TRANSCRIPT_READY: "knugget:transcript:ready",
  SUMMARY_READY: "knugget:summary:ready",
  CONTENT_SAVED: "knugget:content:saved",
  ERROR: "knugget:error",
} as const;