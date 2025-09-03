// src/platforms/website/content-service.ts - Website Content Service
import { config } from "../../config";

export interface WebsiteContentRequest {
  title: string;
  content: string;
  url: string;
  websiteName: string;
}

export interface WebsiteContentResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    keyPoints: string[];
    fullSummary: string;
    tags: string[];
    websiteData: WebsiteContentRequest;
    saved: boolean;
  };
  error?: string;
}

export class WebsiteContentService {
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

  async generateSummary(websiteContentRequest: WebsiteContentRequest): Promise<WebsiteContentResponse> {
    try {
      // Verify authentication
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      console.log("Generating summary for website:", websiteContentRequest.url);

      // Use background script to make the API call
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_WEBSITE_SUMMARY",
        payload: websiteContentRequest
      });

      if (!response?.success) {
        console.error("Website summary generation failed:", response?.error);
        return {
          success: false,
          error: response?.error || "Failed to generate summary"
        };
      }

      console.log("Website summary generated successfully:", response.data);

      return {
        success: true,
        data: {
          ...response.data,
          saved: false // Mark as not saved yet
        }
      };

    } catch (error) {
      console.error("Error generating website summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      };
    }
  }

  async saveSummary(summaryData: any): Promise<WebsiteContentResponse> {
    try {
      // Verify authentication
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      console.log("Saving website summary to backend:", summaryData);

      // Use background script to make the API call
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_WEBSITE_SUMMARY",
        payload: summaryData
      });

      if (!response?.success) {
        console.error("Website summary save failed:", response?.error);
        return {
          success: false,
          error: response?.error || "Failed to save summary"
        };
      }

      console.log("Website summary saved successfully:", response.data);

      return {
        success: true,
        data: {
          ...response.data,
          saved: true
        }
      };

    } catch (error) {
      console.error("Error saving website summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
      };
    }
  }

  // Check if summary already exists for this URL
  async checkExistingSummary(url: string): Promise<WebsiteContentResponse> {
    try {
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      console.log("Checking existing summary for URL:", url);

      // Use background script to make the API call
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_EXISTING_WEBSITE_SUMMARY",
        payload: { url }
      });

      if (!response?.success) {
        console.error("Check existing website summary failed:", response?.error);
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
      console.error("Error checking existing website summary:", error);
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

export const websiteContentService = new WebsiteContentService();