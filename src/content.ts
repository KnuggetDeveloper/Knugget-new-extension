import "./styles.css";

class ContentScriptManager {
  private currentHandler: any = null;
  private site: string = 'unknown';

  constructor() {
    this.initialize();
  }

  private detectSite(): 'youtube' | 'linkedin' | 'unknown' {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('youtube.com')) {
      return 'youtube';
    } else if (hostname.includes('linkedin.com')) {
      return 'linkedin';
    }
    
    return 'unknown';
  }

  private async initialize(): Promise<void> {
    this.site = this.detectSite();
    
    console.log(`🎯 Knugget Extension loading for: ${this.site}`);
    
    try {
      switch (this.site) {
        case 'youtube':
          const { YouTubeHandler } = await import('./sites/youtube/youtube-handler');
          this.currentHandler = new YouTubeHandler();
          break;
        case 'linkedin':
          const { LinkedInHandler } = await import('./sites/linkedin/linkedin-handler');
          this.currentHandler = new LinkedInHandler();
          break;
        default:
          console.log('🚫 Unsupported site, extension not loading');
          return;
      }

      if (this.currentHandler) {
        await this.currentHandler.initialize();
        console.log(`✅ ${this.site} handler initialized successfully`);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.site} handler:`, error);
    }
  }

  // Cleanup when navigating away
  cleanup(): void {
    if (this.currentHandler && typeof this.currentHandler.cleanup === 'function') {
      this.currentHandler.cleanup();
    }
  }
}

// Initialize the content script manager
const contentManager = new ContentScriptManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentManager.cleanup();
});