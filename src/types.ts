// src/types.ts - Unified Types for Multi-Platform Extension
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

// Platform Support
export enum Platform {
  YOUTUBE = "youtube",
  LINKEDIN = "linkedin",
  UNKNOWN = "unknown"
}

// YouTube-specific types
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

// LinkedIn-specific types
export interface LinkedInPost {
  id: string;
  author: string;
  content: string;
  url: string;
  platform: Platform.LINKEDIN;
  savedAt: string;
  source: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
  timestamp?: string;
}

// Universal Content Types
export interface SavedContent {
  id: string;
  platform: Platform;
  title?: string;
  content: string;
  author: string;
  url: string;
  savedAt: string;
  metadata?: VideoMetadata | LinkedInPost;
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
  currentPlatform: Platform;
  currentVideo: VideoMetadata | null;
  transcript: TranscriptSegment[] | null;
  summary: Summary | null;
  savedPosts: LinkedInPost[];
  isLoading: boolean;
  error: string | null;
}

export interface Message {
  type: MessageType;
  data?: any;
  platform?: Platform;
  timestamp?: number;
}

export enum MessageType {
  // Auth related
  AUTH_STATUS_CHANGED = "AUTH_STATUS_CHANGED",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGOUT = "LOGOUT",

  // Platform detection
  PLATFORM_ACTIVE = "PLATFORM_ACTIVE",
  PLATFORM_INACTIVE = "PLATFORM_INACTIVE",

  // YouTube specific
  VIDEO_CHANGED = "VIDEO_CHANGED",
  TRANSCRIPT_LOADED = "TRANSCRIPT_LOADED",
  SUMMARY_GENERATED = "SUMMARY_GENERATED",
  SUMMARY_SAVED = "SUMMARY_SAVED",

  // LinkedIn specific
  LINKEDIN_POST_DETECTED = "LINKEDIN_POST_DETECTED",
  LINKEDIN_POST_SAVED = "LINKEDIN_POST_SAVED",

  // UI related
  SHOW_PANEL = "SHOW_PANEL",
  HIDE_PANEL = "HIDE_PANEL",
  TOGGLE_PANEL = "TOGGLE_PANEL",

  // Error handling
  ERROR = "ERROR",

  // Background sync
  SYNC_AUTH = "SYNC_AUTH",
  REFRESH_TOKEN = "REFRESH_TOKEN",
}

export interface PlatformConfig {
  name: string;
  selectors: { [key: string]: string };
  features: string[];
}

export interface KnuggetConfig {
  apiBaseUrl: string;
  websiteUrl: string;
  refreshTokenThreshold: number;
  maxRetries: number;
  retryDelay: number;
  platforms: {
    [Platform.YOUTUBE]: PlatformConfig;
    [Platform.LINKEDIN]: PlatformConfig;
  };
}

// Chrome extension specific types
declare global {
  interface Window {
    __KNUGGET_STATE__?: ExtensionState;
    knuggetLinkedInDetector?: () => any;
    knuggetDetector?: any;
  }
}
