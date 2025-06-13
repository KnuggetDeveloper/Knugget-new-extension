// src/services/auth.ts - Simplified extension auth service
import { AuthData, User } from "../types";
import { config, storageKeys } from "../config";

class AuthService {
  private authData: AuthData | null = null
  private isRefreshing = false

  constructor() {
    this.initializeAuth()
  }

  private async initializeAuth(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([storageKeys.AUTH_DATA])
      if (result[storageKeys.AUTH_DATA]) {
        this.authData = result[storageKeys.AUTH_DATA]
        
        if (this.isAuthDataValid(this.authData)) {
          console.log("✅ Auth initialized from storage")
        } else {
          console.warn("⚠️ Invalid auth data found, clearing")
          await this.clearAuthData()
        }
      }
    } catch (error) {
      console.error("❌ Failed to initialize auth:", error)
      await this.clearAuthData()
    }
  }

  private isAuthDataValid(authData: AuthData | null): boolean {
    if (!authData) return false
    
    return (
      typeof authData.token === 'string' &&
      authData.token.length > 0 &&
      typeof authData.expiresAt === 'number' &&
      authData.expiresAt > Date.now() &&
      authData.user &&
      typeof authData.user.id === 'string'
    )
  }

  /**
   * Handle external auth change from frontend
   */
  async handleExternalAuthChange(authData: AuthData): Promise<void> {
    try {
      if (!this.isAuthDataValid(authData)) {
        throw new Error("Invalid auth data received from external source")
      }

      this.authData = authData
      await this.storeAuthData(authData)
      
      console.log("✅ Auth data updated from external source")
      this.notifyAuthStateChanged(true)
      
    } catch (error) {
      console.error("❌ Failed to handle external auth change:", error)
      await this.clearAuthData()
      this.notifyAuthStateChanged(false)
      throw error
    }
  }

  /**
   * Enhanced logout with proper cleanup
   */
  async logout(): Promise<void> {
    try {
      console.log('🔄 Extension logout initiated')
      
      this.isRefreshing = false
      await this.clearAuthData()
      this.authData = null
      this.notifyAuthStateChanged(false)
      
      console.log('✅ Extension auth data cleared completely')
    } catch (error) {
      console.error('❌ Error during extension logout:', error)
      this.authData = null
      this.notifyAuthStateChanged(false)
    }
  }

  /**
   * Enhanced token refresh
   */
  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) return false
    if (!this.authData?.refreshToken) {
      console.error("❌ No refresh token available")
      await this.logout()
      return false
    }

    this.isRefreshing = true

    try {
      console.log(`🔄 Attempting token refresh`)
      
      const response = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.authData.refreshToken }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          const newAuthData: AuthData = {
            token: data.data.accessToken,
            refreshToken: data.data.refreshToken,
            user: data.data.user,
            expiresAt: data.data.expiresAt,
            loginTime: new Date().toISOString(),
          }

          await this.handleExternalAuthChange(newAuthData)
          console.log("✅ Token refresh successful")
          return true
        }
      }

      if (response.status === 401 || response.status === 403) {
        console.error("❌ Refresh token is invalid or expired")
        await this.logout()
        return false
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)

    } catch (error) {
      console.error("❌ Token refresh failed:", error)
      await this.logout()
      return false
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Store auth data with error handling
   */
  private async storeAuthData(authData: AuthData): Promise<void> {
    try {
      await chrome.storage.local.set({ [storageKeys.AUTH_DATA]: authData })
    } catch (error) {
      throw new Error(`Failed to store auth data: ${error}`)
    }
  }

  /**
   * Clear auth data from storage
   */
  private async clearAuthData(): Promise<void> {
    try {
      await chrome.storage.local.remove([storageKeys.AUTH_DATA])
      await chrome.storage.local.remove(['knugget_last_auth_state'])
      console.log('✅ Extension storage cleared completely')
    } catch (error) {
      console.error('❌ Error clearing extension auth data:', error)
    }
  }

  /**
   * Notify auth state change
   */
  private notifyAuthStateChanged(isAuthenticated: boolean): void {
    try {
      chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        data: {
          isAuthenticated,
          user: isAuthenticated ? this.user : null,
          timestamp: new Date().toISOString()
        }
      }).catch(() => {
        // Ignore errors if no listeners
      })

      chrome.storage.local.set({
        'knugget_last_auth_state': {
          isAuthenticated,
          timestamp: new Date().toISOString()
        }
      }).catch(error => {
        console.warn("Failed to store auth state:", error)
      })

      console.log(`📡 Auth state notification sent: ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`)
    } catch (error) {
      console.error("❌ Error notifying auth state change:", error)
    }
  }

  /**
   * Check if token needs refresh
   */
  private needsRefresh(): boolean {
    if (!this.authData?.expiresAt) return false
    
    const now = Date.now()
    const expiresAt = this.authData.expiresAt
    const refreshThreshold = config.refreshTokenThreshold * 60 * 1000
    
    return (expiresAt - now) <= refreshThreshold
  }

  // Getters
  get isAuthenticated(): boolean {
    try {
      return this.isAuthDataValid(this.authData)
    } catch (error) {
      console.error("Error checking auth status:", error)
      return false
    }
  }

  get user(): User | null {
    return this.isAuthenticated ? this.authData!.user : null
  }

  get token(): string | null {
    return this.isAuthenticated ? this.authData!.token : null
  }

  /**
   * Handle API 401 errors
   */
  async handle401Error(): Promise<void> {
    console.log("🔄 Handling 401 error from API")
    
    const refreshSuccess = await this.refreshToken()
    if (!refreshSuccess) {
      await this.logout()
    }
  }

  /**
   * Get auth status with health check
   */
  async getAuthStatus(): Promise<{ isAuthenticated: boolean; user: User | null; needsRefresh: boolean }> {
    try {
      const isAuthenticated = this.isAuthenticated
      const needsRefresh = this.needsRefresh()
      
      return {
        isAuthenticated,
        user: this.user,
        needsRefresh
      }
    } catch (error) {
      console.error("Error getting auth status:", error)
      return {
        isAuthenticated: false,
        user: null,
        needsRefresh: false
      }
    }
  }
}

export const authService = new AuthService()