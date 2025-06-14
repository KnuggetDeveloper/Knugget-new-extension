import { config } from "../config";
import { authService } from "./auth";
import { ApiResponse, Platform, LinkedInPost, Summary } from "../types";

class ApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    // Universal content saving
    async saveContent(contentData: any, platform: Platform): Promise<ApiResponse> {
        try {
            const endpoint = platform === Platform.YOUTUBE ? '/summaries' : '/posts';

            const response = await this.makeRequest('POST', endpoint, {
                ...contentData,
                platform,
            });

            return response;
        } catch (error) {
            console.error(`Failed to save ${platform} content:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to save content'
            };
        }
    }

    // Get saved content by platform
    async getSavedContent(platform?: Platform): Promise<ApiResponse> {
        try {
            let endpoint = '/content';
            if (platform) {
                endpoint += `?platform=${platform}`;
            }

            const response = await this.makeRequest('GET', endpoint);
            return response;
        } catch (error) {
            console.error('Failed to get saved content:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get content'
            };
        }
    }

    // YouTube-specific: Generate summary
    async generateSummary(transcriptData: any): Promise<ApiResponse<Summary>> {
        try {
            const response = await this.makeRequest('POST', '/youtube/summarize', transcriptData);
            return response;
        } catch (error) {
            console.error('Failed to generate summary:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate summary'
            };
        }
    }

    // LinkedIn-specific: Save post
    async saveLinkedInPost(postData: LinkedInPost): Promise<ApiResponse> {
        try {
            const response = await this.makeRequest('POST', '/linkedin/posts', postData);
            return response;
        } catch (error) {
            console.error('Failed to save LinkedIn post:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to save post'
            };
        }
    }

    // Generic API request method
    protected async makeRequest(method: string, endpoint: string, data?: any): Promise<ApiResponse> {
        const token = authService.token;

        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            signal: AbortSignal.timeout(30000), // 30 second timeout
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            if (response.status === 401) {
                // Token expired, try to refresh
                const refreshed = await authService.refreshToken();
                if (refreshed) {
                    // Retry with new token
                    options.headers = {
                        ...options.headers,
                        'Authorization': `Bearer ${authService.token}`
                    };
                    return this.makeRequest(method, endpoint, data);
                } else {
                    await authService.logout();
                    throw new Error('Authentication expired');
                }
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `HTTP ${response.status}`);
            }

            return {
                success: true,
                data: result.data,
                message: result.message
            };

        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                throw error;
            }
            throw new Error('Network request failed');
        }
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

export const apiService = new ApiService();
