// src/platforms/youtube/summary.ts - YouTube Summary Service
import { config } from "../../config";
import { TranscriptSegment, VideoMetadata } from "../../types";

export interface SummaryRequest {
  transcript: TranscriptSegment[];
  videoMetadata: VideoMetadata;
}

export interface SummaryResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    keyPoints: string[];
    fullSummary: string;
    tags: string[];
    videoMetadata: VideoMetadata;
    transcript: TranscriptSegment[];
    saved: boolean;
  };
  error?: string;
}

export class YouTubeSummaryService {
  private async getAuthToken(): Promise<string | null> {
    try {
      const authStorage = await chrome.storage.local.get(['knugget_auth']);
      return authStorage.knugget_auth?.token || null;
    } catch (error) {
      console.error("Failed to get auth token:", error);
      return null;
    }
  }

  private async checkAuthStatus(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_AUTH_STATUS",
      });
      return response?.isAuthenticated || false;
    } catch (error) {
      console.error("Failed to check auth status:", error);
      return false;
    }
  }

  async generateSummary(summaryRequest: SummaryRequest): Promise<SummaryResponse> {
    try {
      // Verify authentication
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      console.log("Generating summary for video:", summaryRequest.videoMetadata.videoId);

      // Use background script to make the API call
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_SUMMARY",
        payload: summaryRequest
      });

      if (!response?.success) {
        console.error("Summary generation failed:", response?.error);
        return {
          success: false,
          error: response?.error || "Failed to generate summary"
        };
      }

      console.log("Summary generated successfully:", response.data);

      return {
        success: true,
        data: {
          ...response.data,
          saved: false // Mark as not saved yet
        }
      };

    } catch (error) {
      console.error("Error generating summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      };
    }
  }

  async saveSummary(summaryData: any): Promise<SummaryResponse> {
    try {
      // Verify authentication
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      console.log("Saving summary to backend:", summaryData);

      // Use background script to make the API call
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_SUMMARY",
        payload: summaryData
      });

      if (!response?.success) {
        console.error("Summary save failed:", response?.error);
        return {
          success: false,
          error: response?.error || "Failed to save summary"
        };
      }

      console.log("Summary saved successfully:", response.data);

      return {
        success: true,
        data: {
          ...response.data,
          saved: true
        }
      };

    } catch (error) {
      console.error("Error saving summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      };
    }
  }

  // Check if summary already exists for this video
  async checkExistingSummary(videoId: string): Promise<SummaryResponse> {
    try {
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      console.log("Checking existing summary for video:", videoId);

      // Use background script to make the API call
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_EXISTING_SUMMARY",
        payload: { videoId }
      });

      if (!response?.success) {
        console.error("Check existing summary failed:", response?.error);
        return {
          success: false,
          error: response?.error || "Failed to check existing summary"
        };
      }

      if (response.data) {
        return {
          success: true,
          data: {
            ...response.data,
            saved: true
          }
        };
      }

      return {
        success: true,
        data: undefined
      };

    } catch (error) {
      console.error("Error checking existing summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check existing summary"
      };
    }
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) return false;

      const response = await fetch(`${config.apiBaseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error("API connection test failed:", error);
      return false;
    }
  }
}

export const youtubeSummaryService = new YouTubeSummaryService();