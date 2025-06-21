// src/platforms/linkedin/api.ts - LinkedIn API service helper
import { config } from "../../config";

export interface LinkedInPostData {
  title?: string;
  content: string;
  author: string;
  postUrl: string;
  platform: string;
  metadata?: {
    authorAbout?: string;
    authorImage?: string | null;
    timestamp: string;
    source: string;
  };
}

export interface SaveResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class LinkedInApiService {
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

  async savePost(postData: LinkedInPostData): Promise<SaveResponse> {
    try {
      // Verify authentication
      const isAuthenticated = await this.checkAuthStatus();
      if (!isAuthenticated) {
        return {
          success: false,
          error: "User not authenticated"
        };
      }

      // Get auth token
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: "No authentication token found"
        };
      }

      console.log("Saving LinkedIn post to backend:", postData);

      // Make API request
      const response = await fetch(`${config.apiBaseUrl}/linkedin/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      });

      // Handle response
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }

        console.error("Backend save failed:", response.status, errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      const result = await response.json();
      console.log("LinkedIn post saved successfully:", result);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error("Error saving LinkedIn post:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred"
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

export const linkedInApiService = new LinkedInApiService();