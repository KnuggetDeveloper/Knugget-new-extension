import { SiteHandler } from '../base/site-handler.interface';
import { LinkedInUI } from './linkedin-ui';
import { LinkedInExtractor } from './linkedin-extractor';
import { authService } from '../../services/auth';
import { apiService } from '../../services/api';

export class LinkedInHandler implements SiteHandler {
  private ui: LinkedInUI;
  private extractor: LinkedInExtractor;
  private observer: MutationObserver | null = null;
  private processedPosts = new Set<string>();

  constructor() {
    this.ui = new LinkedInUI();
    this.extractor = new LinkedInExtractor();
  }

  async initialize(): Promise<void> {
    console.log('🔵 LinkedIn handler initializing...');
    
    // Wait for page to be ready
    await this.waitForPageReady();
    
    // Start observing for posts
    this.startObservingPosts();
    
    // Process existing posts
    this.processExistingPosts();
    
    console.log('✅ LinkedIn handler initialized');
  }

  private async waitForPageReady(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
        return;
      }
      
      const checkReady = () => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  private startObservingPosts(): void {
    this.observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldProcess = true;
        }
      });
      
      if (shouldProcess) {
        this.debounce(() => this.processExistingPosts(), 500)();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private processExistingPosts(): void {
    const posts = this.extractor.findAllPosts();
    
    posts.forEach((post) => {
      const postId = this.extractor.getPostId(post);
      
      if (!postId || this.processedPosts.has(postId)) {
        return;
      }
      
      this.processedPosts.add(postId);
      this.ui.injectSaveButton(post, () => this.handleSavePost(post));
    });
  }

  private async handleSavePost(postElement: Element): Promise<void> {
    try {
      // Check authentication
      if (!authService.isAuthenticated) {
        this.ui.showAuthRequired();
        return;
      }

      // Extract post data
      const postData = this.extractor.extractPostData(postElement);
      if (!postData) {
        this.ui.showError('Failed to extract post data');
        return;
      }

      // Show loading state
      this.ui.showSaving(postElement);

      // Save to backend
      const result = await apiService.saveLinkedInPost(postData);
      
      if (result.success) {
        this.ui.showSuccess(postElement);
      } else {
        this.ui.showError(result.error || 'Failed to save post');
      }
    } catch (error) {
      console.error('Error saving LinkedIn post:', error);
      this.ui.showError('An error occurred while saving');
    }
  }
  private debounce(func: Function, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  getSiteName(): string {
    return 'linkedin';
  }

  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.processedPosts.clear();
  }
}