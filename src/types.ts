// types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: "free" | "premium";
  avatar?: string;
}

export interface AuthData {
  token: string;
  refreshToken?: string;
  user: User;
  expiresAt: number;
  loginTime: string;
}

export interface TranscriptSegment {
  timestamp: string;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  channelName: string;
  duration: string;
  url: string;
  thumbnailUrl?: string;
}

export interface Summary {
  id?: string;
  title: string;
  keyPoints: string[];
  fullSummary: string;
  tags?: string[];
  videoMetadata: VideoMetadata;
  transcript?: TranscriptSegment[];
  createdAt?: string;
  saved?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ExtensionState {
  isAuthenticated: boolean;
  user: User | null;
  currentVideo: VideoMetadata | null;
  transcript: TranscriptSegment[] | null;
  summary: Summary | null;
  isLoading: boolean;
  error: string | null;
}
export interface LinkedInPostData {
  id: string;
  content: string;
  author: LinkedInAuthor;
  url: string;
  timestamp: string;
  type: 'linkedin';
  metadata: {
    extractedAt: string;
    pageType: string;
    postType?: 'article' | 'update' | 'share' | 'poll';
    metrics?: {
      likes?: number;
      comments?: number;
      reposts?: number;
    };
    media?: {
      images?: string[];
      videos?: string[];
      documents?: string[];
    };
  };
}

export interface LinkedInAuthor {
  name: string;
  title?: string;
  profileUrl?: string;
  company?: string;
  avatar?: string;
}

export interface SiteConfig {
  youtube: {
    enabled: boolean;
    features: ('transcript' | 'summary' | 'save')[];
  };
  linkedin: {
    enabled: boolean;
    features: ('save' | 'export' | 'analytics')[];
  };
}

export interface MultiSiteState extends ExtensionState {
  currentSite: 'youtube' | 'linkedin' | 'unknown';
  siteConfig: SiteConfig;
  linkedinStats?: {
    totalSaved: number;
    savedToday: number;
    lastSave?: string;
  };
}

export interface Message {
  type: MessageType;
  data?: any;
  timestamp?: number;
}

export enum MessageType {
  // Auth related
  AUTH_STATUS_CHANGED = "AUTH_STATUS_CHANGED",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGOUT = "LOGOUT",

  // Video related
  VIDEO_CHANGED = "VIDEO_CHANGED",
  TRANSCRIPT_LOADED = "TRANSCRIPT_LOADED",
  SUMMARY_GENERATED = "SUMMARY_GENERATED",
  SUMMARY_SAVED = "SUMMARY_SAVED",

  // UI related
  SHOW_PANEL = "SHOW_PANEL",
  HIDE_PANEL = "HIDE_PANEL",
  TOGGLE_PANEL = "TOGGLE_PANEL",

  // Error handling
  ERROR = "ERROR",

  // Background sync
  SYNC_AUTH = "SYNC_AUTH",
  REFRESH_TOKEN = "REFRESH_TOKEN",

  LINKEDIN_POST_DETECTED = "LINKEDIN_POST_DETECTED",
  LINKEDIN_POST_SAVED = "LINKEDIN_POST_SAVED",
  LINKEDIN_POST_ERROR = "LINKEDIN_POST_ERROR",
  LINKEDIN_STATS_UPDATED = "LINKEDIN_STATS_UPDATED",
  SITE_CHANGED = "SITE_CHANGED",
  PERMISSIONS_CHECK = "PERMISSIONS_CHECK",
  FEATURE_TOGGLE = "FEATURE_TOGGLE",
}

export interface KnuggetConfig {
  apiBaseUrl: string;
  websiteUrl: string;
  refreshTokenThreshold: number; // minutes before expiry to refresh
  maxRetries: number;
  retryDelay: number;
}