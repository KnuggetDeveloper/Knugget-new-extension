import { KnuggetConfig } from "./types";

export const config: KnuggetConfig = {
  apiBaseUrl: "https://knugget-new-backend.onrender.com/api",
  websiteUrl: "https://knugget-new-client.vercel.app",
  refreshTokenThreshold: 5,
  maxRetries: 3,
  retryDelay: 1000,
};

// UPDATED: Multi-site selectors
export const selectors = {
  // YouTube DOM selectors
  youtube: {
    secondaryColumn: "#secondary",
    videoTitle: "h1.ytd-watch-metadata #title, h1.title, #container h1, ytd-watch-metadata h1",
    channelName: "#top-row .ytd-channel-name a, #channel-name a, #owner-name a, ytd-channel-name a",
    transcriptButton: 'button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]',
    transcriptSegments: "ytd-transcript-segment-renderer, .segment, .ytd-transcript-segment-renderer",
    expandButton: "tp-yt-paper-button#expand, .more-button, #expand",
    moreButton: "#top-level-buttons-computed ytd-menu-renderer, ytd-menu-renderer",
  },

  // NEW: LinkedIn DOM selectors
  linkedin: {
    posts: [
      'div[data-id^="urn:li:activity"]',
      '.feed-shared-update-v2',
      'article.relative',
      '.organizations-entity-card',
      '[data-urn*="activity"]'
    ],
    content: [
      '.feed-shared-text',
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.break-words',
      '[data-test-id="main-feed-activity-card__commentary"]'
    ],
    author: {
      name: [
        '.feed-shared-actor__name',
        '.update-components-actor__name',
        '.artdeco-entity-lockup__title',
        '[data-test-id="main-feed-activity-card__actor-name"]'
      ],
      title: [
        '.feed-shared-actor__description',
        '.update-components-actor__description',
        '.artdeco-entity-lockup__subtitle'
      ],
      profileUrl: [
        '.feed-shared-actor__container-link',
        '.update-components-actor__container a',
        '.artdeco-entity-lockup__title a'
      ]
    },
    timestamp: [
      '.feed-shared-actor__sub-description time',
      '.update-components-actor__sub-description time',
      'time[datetime]',
      '.visually-hidden'
    ],
    actionBars: [
      '.feed-shared-social-action-bar',
      '.update-components-linkedin-reactions-bar',
      '.social-action',
      '.feed-shared-actions-bar'
    ]
  },

  // Extension UI selectors (unchanged)
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
  CACHED_LINKEDIN_POSTS: "knugget_linkedin_cache", // NEW
  LAST_SYNC: "knugget_last_sync",
  SITE_PERMISSIONS: "knugget_site_permissions", // NEW
};

export const events = {
  AUTH_CHANGED: "knugget:auth:changed",
  VIDEO_CHANGED: "knugget:video:changed",
  TRANSCRIPT_READY: "knugget:transcript:ready",
  SUMMARY_READY: "knugget:summary:ready",
  LINKEDIN_POST_DETECTED: "knugget:linkedin:post:detected", // NEW
  LINKEDIN_POST_SAVED: "knugget:linkedin:post:saved", // NEW
  ERROR: "knugget:error",
} as const;

// NEW: Site detection utilities
export const siteDetection = {
  youtube: {
    hostnames: ['youtube.com', 'www.youtube.com'],
    paths: ['/watch'],
    detectVideo: () => {
      const url = new URL(window.location.href);
      return url.pathname === '/watch' && url.searchParams.has('v');
    }
  },
  linkedin: {
    hostnames: ['linkedin.com', 'www.linkedin.com'],
    paths: ['/feed', '/in/', '/company/', '/posts/'],
    detectPosts: () => {
      return document.querySelectorAll(selectors.linkedin.posts.join(',')).length > 0;
    }
  }
};

// NEW: API endpoints configuration
export const apiEndpoints = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    me: '/auth/me',
    logout: '/auth/logout'
  },
  youtube: {
    generateSummary: '/summary/generate',
    saveSummary: '/summary/save',
    getSummaries: '/summary'
  },
  linkedin: {
    savePost: '/posts/linkedin', // NEW
    getPosts: '/posts/linkedin', // NEW
    deletePost: '/posts/linkedin' // NEW
  },
  health: '/health'
};