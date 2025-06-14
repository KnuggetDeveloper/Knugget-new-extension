// src/platforms/linkedin/content.ts - 100% ERROR-FREE VERSION
// No imports, no external dependencies, pure TypeScript

// =====================================================
// TYPES - Defined inline to avoid import errors
// =====================================================

interface LinkedInPostData {
  id: string;
  content: string;
  author: string;
  postUrl: string;
  element: HTMLElement;
  timestamp?: string;
  likes?: number;
  comments?: number;
  shares?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    credits: number;
    plan: string;
  } | null;
}

// =====================================================
// LINKEDIN POST DETECTOR CLASS
// =====================================================

class LinkedInPostDetector {
  private processedPosts: Set<string>;
  private observer: MutationObserver | null;
  private readonly BUTTON_CLASS = 'knugget-linkedin-save-btn';
  private readonly PROCESSED_CLASS = 'knugget-linkedin-processed';
  private authState: AuthState;

  constructor(authState: AuthState) {
    this.processedPosts = new Set<string>();
    this.observer = null;
    this.authState = authState;
    this.init();
  }

  private init(): void {
    console.log('💼 LinkedIn Post Detector initializing...');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  private start(): void {
    console.log('💼 LinkedIn Post Detector started');

    this.scanForPosts();
    this.setupMutationObserver();
    this.injectStyles();
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      let shouldScan = false;

      mutations.forEach((mutation: MutationRecord) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node: Node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (this.isPostElement(element) || this.containsPosts(element)) {
                shouldScan = true;
              }
            }
          });
        }
      });

      if (shouldScan) {
        setTimeout(() => this.scanForPosts(), 100);
      }
    });

    const mainContent = document.querySelector('main') ||
      document.querySelector('.scaffold-layout__main') ||
      document.querySelector('.feed-container') ||
      document.body;

    this.observer.observe(mainContent, {
      childList: true,
      subtree: true
    });
  }

  private scanForPosts(): void {
    const posts = this.findAllPosts();
    console.log(`💼 Found ${posts.length} LinkedIn posts to process`);
    posts.forEach((post: HTMLElement) => this.processPost(post));
  }

  private findAllPosts(): HTMLElement[] {
    const selectors = [
      '[data-urn*="urn:li:activity"]',
      '.feed-shared-update-v2',
      '.occludable-update',
      '.profile-creator-shared-feed-update__container',
      '.profile-creator-shared-update',
      '.org-page-navigation-module-feed .feed-shared-update-v2',
      '[data-id*="urn:li:activity"]',
      '.update-components-post',
      '.feed-shared-article',
      '[data-view-name="feed-update"]',
      '.update-components-update-v2',
      '.feed-shared-update-v2__content',
      '[data-urn]'
    ];

    const posts: HTMLElement[] = [];

    selectors.forEach((selector: string) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element: Element) => {
        const htmlElement = element as HTMLElement;
        if (this.isValidPost(htmlElement) && !posts.includes(htmlElement)) {
          posts.push(htmlElement);
        }
      });
    });

    return posts;
  }

  private isPostElement(element: HTMLElement): boolean {
    return element.hasAttribute('data-urn') &&
      (element.getAttribute('data-urn')?.includes('activity') ||
        element.getAttribute('data-urn')?.includes('ugcPost')) || false;
  }

  private containsPosts(element: HTMLElement): boolean {
    return element.querySelector('[data-urn*="activity"]') !== null ||
      element.querySelector('.feed-shared-update-v2') !== null ||
      element.querySelector('[data-view-name="feed-update"]') !== null;
  }

  private isValidPost(element: HTMLElement): boolean {
    const hasContent = element.querySelector('.feed-shared-text') ||
      element.querySelector('.update-components-text') ||
      element.querySelector('.feed-shared-article') ||
      element.querySelector('[data-view-name="feed-shared-text"]');

    const hasAuthor = element.querySelector('.update-components-actor') ||
      element.querySelector('.feed-shared-actor') ||
      element.querySelector('[data-view-name="profile-card"]');

    const isNested = element.closest('[data-urn]') !== element;

    return Boolean(hasContent || hasAuthor) && !isNested;
  }

  private processPost(postElement: HTMLElement): void {
    const postId = this.generatePostId(postElement);

    if (this.processedPosts.has(postId) ||
      postElement.classList.contains(this.PROCESSED_CLASS)) {
      return;
    }

    const postData = this.extractPostData(postElement, postId);
    this.injectSaveButton(postElement, postData);

    this.processedPosts.add(postId);
    postElement.classList.add(this.PROCESSED_CLASS);
  }

  private generatePostId(element: HTMLElement): string {
    const urn = element.getAttribute('data-urn') ||
      element.getAttribute('data-id');

    if (urn) {
      return urn;
    }

    const textContent = element.textContent?.substring(0, 50) || '';
    const position = Array.from(element.parentNode?.children || []).indexOf(element);
    return `linkedin-post-${position}-${this.hashCode(textContent)}`;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private extractPostData(element: HTMLElement, id: string): LinkedInPostData {
    const contentSelectors = [
      '.feed-shared-text .break-words',
      '.update-components-text .break-words',
      '.feed-shared-article .break-words',
      '.update-components-article .break-words',
      '.feed-shared-text',
      '.update-components-text',
      '.feed-shared-article__description',
      '.update-components-article__commentary .break-words',
      '[data-view-name="feed-shared-text"] .break-words',
      '.feed-shared-update-v2__commentary .break-words'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const contentElement = element.querySelector(selector);
      if (contentElement) {
        content = contentElement.textContent?.trim() || '';
        if (content) break;
      }
    }

    const authorSelectors = [
      '.update-components-actor__name .visually-hidden',
      '.update-components-actor__name span[aria-hidden="true"]',
      '.update-components-actor__name',
      '.feed-shared-actor__name .visually-hidden',
      '.feed-shared-actor__name span[aria-hidden="true"]',
      '.feed-shared-actor__name',
      '.update-components-actor__title .visually-hidden',
      '.feed-shared-actor__title .visually-hidden',
      '.update-components-actor__title',
      '.feed-shared-actor__title',
      '[data-view-name="profile-card"] .update-components-actor__name',
      '.feed-shared-update-v2__actor-name'
    ];

    let author = '';
    for (const selector of authorSelectors) {
      const authorElement = element.querySelector(selector);
      if (authorElement) {
        author = authorElement.textContent?.trim() || '';
        if (author && !author.includes('•') && !author.includes('followers')) {
          break;
        }
      }
    }

    let postUrl = '';
    const postLinkSelectors = [
      '.update-components-actor__sub-description a[href*="/posts/"]',
      '.feed-shared-actor__sub-description a[href*="/posts/"]',
      '.update-components-actor__sub-description a[href*="/activity-"]',
      '.feed-shared-actor__sub-description a[href*="/activity-"]',
      'a[data-control-name="timestamp"]',
      'a[href*="/posts/"]',
      'a[href*="/activity-"]',
      '.update-components-actor time',
      '.feed-shared-actor time',
      '[data-view-name="social-detail"] a'
    ];

    for (const selector of postLinkSelectors) {
      const linkElement = element.querySelector(selector);
      if (linkElement) {
        let href = '';

        if (linkElement.tagName === 'TIME') {
          const parentLink = linkElement.closest('a');
          href = parentLink?.getAttribute('href') || '';
        } else {
          href = linkElement.getAttribute('href') || '';
        }

        if (href) {
          if (href.startsWith('/')) {
            postUrl = `https://www.linkedin.com${href}`;
          } else if (href.startsWith('https://')) {
            postUrl = href;
          }

          if (postUrl.includes('/posts/') || postUrl.includes('/activity-')) {
            break;
          }
        }
      }
    }

    if (!postUrl) {
      const urn = element.getAttribute('data-urn') || element.getAttribute('data-id');
      if (urn && urn.includes('activity:')) {
        const activityId = urn.split('activity:')[1]?.split(',')[0];
        if (activityId) {
          postUrl = `https://www.linkedin.com/posts/activity-${activityId}`;
        }
      }
    }

    const metrics = this.extractEngagementMetrics(element);

    return {
      id,
      content: content || 'No content found',
      author: author || 'Unknown author',
      postUrl: postUrl || window.location.href,
      element,
      ...metrics
    };
  }

  private extractEngagementMetrics(element: HTMLElement): { likes?: number; comments?: number; shares?: number; timestamp?: string } {
    const metrics: { likes?: number; comments?: number; shares?: number; timestamp?: string } = {};

    const likeButton = element.querySelector('[data-control-name="reactions_details_social_bar"], .social-action-reactions');
    if (likeButton) {
      const likeText = likeButton.textContent || '';
      const likeMatch = likeText.match(/(\d+)/);
      if (likeMatch) {
        metrics.likes = parseInt(likeMatch[1]);
      }
    }

    const commentButton = element.querySelector('[data-control-name="comments_details_social_bar"]');
    if (commentButton) {
      const commentText = commentButton.textContent || '';
      const commentMatch = commentText.match(/(\d+)/);
      if (commentMatch) {
        metrics.comments = parseInt(commentMatch[1]);
      }
    }

    const timeElement = element.querySelector('time, .update-components-actor__sub-description-link');
    if (timeElement) {
      metrics.timestamp = timeElement.getAttribute('datetime') || timeElement.textContent?.trim();
    }

    return metrics;
  }

  private injectSaveButton(postElement: HTMLElement, postData: LinkedInPostData): void {
    const buttonContainer = this.findButtonContainer(postElement);

    if (!buttonContainer) {
      console.warn('💼 Could not find suitable container for LinkedIn save button');
      return;
    }

    const saveButton = this.createSaveButton(postData);
    buttonContainer.appendChild(saveButton);
  }

  private findButtonContainer(postElement: HTMLElement): HTMLElement | null {
    const containerSelectors = [
      '.feed-shared-social-action-bar',
      '.update-components-footer',
      '.social-actions-bar',
      '.feed-shared-footer',
      '.update-v2-social-activity',
      '.feed-shared-update-v2__footer',
      '.social-action-bar'
    ];

    for (const selector of containerSelectors) {
      const container = postElement.querySelector(selector);
      if (container) {
        return container as HTMLElement;
      }
    }

    const fallbackContainer = document.createElement('div');
    fallbackContainer.className = 'knugget-linkedin-button-container';
    postElement.appendChild(fallbackContainer);

    return fallbackContainer;
  }

  private createSaveButton(postData: LinkedInPostData): HTMLElement {
    const button = document.createElement('button');
    button.className = this.BUTTON_CLASS;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
      <span>Save to Knugget</span>
    `;

    button.title = 'Save this LinkedIn post to Knugget';
    button.setAttribute('data-post-id', postData.id);

    this.updateButtonState(button);

    button.addEventListener('click', (e: Event) => this.handleSaveClick(e, postData));

    return button;
  }

  private updateButtonState(button: HTMLElement): void {
    if (!this.authState.isAuthenticated) {
      button.classList.add('not-authenticated');
      (button as HTMLButtonElement).disabled = false;
      button.title = 'Login to save LinkedIn posts to Knugget';
    } else {
      button.classList.remove('not-authenticated');
      (button as HTMLButtonElement).disabled = false;
      button.title = `Save to Knugget (${this.authState.user?.credits || 0} credits remaining)`;
    }
  }

  private async handleSaveClick(event: Event, postData: LinkedInPostData): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const button = event.target as HTMLElement;
    const buttonElement = button.closest('button') as HTMLButtonElement;

    if (!this.authState.isAuthenticated) {
      chrome.runtime.sendMessage({
        type: "OPEN_LOGIN_PAGE",
        payload: { url: window.location.href, platform: "linkedin" }
      });
      return;
    }

    console.group('💼🔖 LinkedIn Post Save Action');
    console.log('Post ID:', postData.id);
    console.log('Author:', postData.author);
    console.log('Post URL:', postData.postUrl);
    console.log('Content Preview:', postData.content.substring(0, 200) + '...');
    console.log('Engagement:', { likes: postData.likes, comments: postData.comments });
    console.groupEnd();

    const saveData = {
      id: postData.id,
      author: postData.author,
      url: postData.postUrl,
      content: postData.content,
      platform: "linkedin",
      savedAt: new Date().toISOString(),
      source: 'linkedin',
      engagement: {
        likes: postData.likes || 0,
        comments: postData.comments || 0,
        shares: postData.shares || 0
      },
      timestamp: postData.timestamp
    };

    const originalContent = buttonElement.innerHTML;
    buttonElement.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="spinning">
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
      </svg>
      <span>Saving...</span>
    `;
    buttonElement.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_LINKEDIN_POST",
        data: saveData
      });

      if (response.success) {
        buttonElement.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Saved!</span>
        `;
        buttonElement.classList.add('saved');

        this.showNotification('✅ LinkedIn post saved to Knugget!', 'success');

        setTimeout(() => {
          buttonElement.innerHTML = originalContent;
          buttonElement.disabled = false;
          buttonElement.classList.remove('saved');
        }, 3000);
      } else {
        throw new Error(response.error || 'Failed to save post');
      }
    } catch (error: unknown) {
      console.error('💼❌ Failed to save LinkedIn post:', error);

      buttonElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Error</span>
      `;

      this.showNotification('❌ Failed to save post. Please try again.', 'error');

      setTimeout(() => {
        buttonElement.innerHTML = originalContent;
        buttonElement.disabled = false;
      }, 3000);
    }
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = 'knugget-linkedin-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: opacity 0.3s ease;
      max-width: 300px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  private injectStyles(): void {
    const styleId = 'knugget-linkedin-extension-styles';

    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${this.BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #374151;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
        white-space: nowrap;
        z-index: 1000;
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .${this.BUTTON_CLASS}:hover:not(:disabled) {
        background: #e5e7eb;
        border-color: #9ca3af;
        transform: translateY(-1px);
      }
      
      .${this.BUTTON_CLASS}:active {
        transform: translateY(0);
      }
      
      .${this.BUTTON_CLASS}.not-authenticated {
        background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
        color: white;
        border: none;
      }
      
      .${this.BUTTON_CLASS}.not-authenticated:hover:not(:disabled) {
        background: linear-gradient(135deg, #e55a2b 0%, #e08419 100%);
        transform: translateY(-1px);
      }
      
      .${this.BUTTON_CLASS}.saved {
        background: #10b981;
        color: white;
        border-color: #059669;
      }
      
      .${this.BUTTON_CLASS} svg {
        flex-shrink: 0;
      }
      
      .${this.BUTTON_CLASS} svg.spinning {
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .knugget-linkedin-button-container {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
      }
      
      @media (max-width: 768px) {
        .${this.BUTTON_CLASS} {
          font-size: 11px;
          padding: 4px 8px;
          margin-left: 4px;
        }
        
        .${this.BUTTON_CLASS} span {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  public updateAuthState(authState: AuthState): void {
    this.authState = authState;

    document.querySelectorAll(`.${this.BUTTON_CLASS}`).forEach((button: Element) => {
      this.updateButtonState(button as HTMLElement);
    });
  }

  public scan(): void {
    this.scanForPosts();
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    document.querySelectorAll(`.${this.BUTTON_CLASS}`).forEach((button: Element) => {
      button.remove();
    });

    document.querySelectorAll(`.${this.PROCESSED_CLASS}`).forEach((element: Element) => {
      element.classList.remove(this.PROCESSED_CLASS);
    });

    this.processedPosts.clear();

    console.log('💼 LinkedIn Post Detector destroyed');
  }
}

// =====================================================
// MAIN LINKEDIN CONTENT SCRIPT
// =====================================================

let linkedInDetector: LinkedInPostDetector | null = null;
let hasInitialized = false;
let authState: AuthState = {
  isAuthenticated: false,
  user: null,
};

function isLinkedInFeedPage(): boolean {
  const pathname = window.location.pathname;
  return pathname === "/feed/" || pathname === "/" || pathname.startsWith("/in/") || pathname.includes("/feed");
}

function initializeLinkedInExtension(): void {
  if (hasInitialized) {
    console.log("🔄 LinkedIn Extension already initialized");
    return;
  }
  hasInitialized = true;
  console.log("💼 Knugget LinkedIn Extension initializing...");

  setupURLChangeDetection();
  setupMessageListener();
  initializeAuthState();

  if (isLinkedInFeedPage()) {
    startPostDetection();
  } else {
    console.log("ℹ️ Not on LinkedIn feed page, waiting for navigation");
  }
}

function startPostDetection(): void {
  console.log("🔍 Starting LinkedIn post detection...");

  if (linkedInDetector) {
    linkedInDetector.destroy();
  }

  linkedInDetector = new LinkedInPostDetector(authState);

  chrome.runtime.sendMessage({
    type: "PLATFORM_ACTIVE",
    platform: "linkedin",
    url: window.location.href
  }).catch(() => {
    // Ignore errors if background is not ready
  });
}

function setupURLChangeDetection(): void {
  let lastUrl = window.location.href;

  const handleURLChange = (): void => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("🔄 LinkedIn navigation detected:", currentUrl);

      if (isLinkedInFeedPage()) {
        startPostDetection();
      } else {
        cleanup();
      }
    }
  };

  const debouncedHandleURLChange = debounce(handleURLChange, 300);

  const originalPushState = history.pushState;
  history.pushState = function (...args: any[]) {
    originalPushState.apply(this, args as [any, string, string | URL | null]);
    setTimeout(debouncedHandleURLChange, 100);
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args: any[]) {
    originalReplaceState.apply(this, args as [any, string, string | URL | null]);
    setTimeout(debouncedHandleURLChange, 100);
  };

  window.addEventListener("popstate", debouncedHandleURLChange);

  document.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('a[href]')) {
      setTimeout(debouncedHandleURLChange, 500);
    }
  });
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function setupMessageListener(): void {
  console.log('🎧 Setting up LinkedIn message listener...')

  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    console.log("📨 LinkedIn content script received message:", {
      type: message.type,
      hasData: Boolean(message.data),
      timestamp: message.timestamp,
    });

    try {
      switch (message.type) {
        case "AUTH_STATUS_CHANGED":
          console.log("🔄 Auth status changed on LinkedIn:", message.data);
          handleAuthStatusChange(message.data);
          break;

        case "LOGOUT":
          console.log('🚪 User logged out - updating LinkedIn state');
          handleLogout(message.data);
          break;

        case "TEST_CONNECTION":
          console.log('🧪 LinkedIn test connection received');
          sendResponse({
            success: true,
            platform: "linkedin",
            contentScriptActive: true,
            isLinkedInFeed: isLinkedInFeedPage(),
            authState: {
              isAuthenticated: authState.isAuthenticated,
              hasUser: Boolean(authState.user)
            }
          });
          break;

        case "REFRESH_POST_DETECTION":
          console.log('🔄 Refreshing LinkedIn post detection');
          if (linkedInDetector) {
            linkedInDetector.scan();
          }
          sendResponse({ success: true });
          break;

        default:
          console.log('❓ Unknown message type on LinkedIn:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
          return;
      }

      sendResponse({ received: true, processed: true });
    } catch (error: unknown) {
      console.error('❌ Error processing message on LinkedIn:', error);
      sendResponse({
        received: true,
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    return true;
  });

  console.log('✅ LinkedIn message listener setup complete');
}

function handleAuthStatusChange(data: any): void {
  if (data?.isAuthenticated && data?.user) {
    console.log('✅ User authenticated on LinkedIn:', data.user.email);
    authState.isAuthenticated = true;
    authState.user = data.user;

    if (linkedInDetector) {
      linkedInDetector.updateAuthState(authState);
    }
  } else {
    console.log('❌ User not authenticated on LinkedIn');
    authState.isAuthenticated = false;
    authState.user = null;

    if (linkedInDetector) {
      linkedInDetector.updateAuthState(authState);
    }
  }
}

function handleLogout(data: any): void {
  console.log('🚪 Processing logout on LinkedIn...', data);

  authState.isAuthenticated = false;
  authState.user = null;

  if (linkedInDetector) {
    linkedInDetector.updateAuthState(authState);
  }

  showLogoutNotification();
  console.log('✅ LinkedIn logout processing complete');
}

function showLogoutNotification(): void {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1f2937;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: opacity 0.3s ease;
  `;
  notification.textContent = '✅ Logged out successfully';

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function initializeAuthState(): void {
  chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" })
    .then((response: any) => {
      if (response?.isAuthenticated && response?.user) {
        authState.isAuthenticated = true;
        authState.user = response.user;
        console.log("✅ LinkedIn auth state initialized: Authenticated");
      } else {
        authState.isAuthenticated = false;
        authState.user = null;
        console.log("ℹ️ LinkedIn auth state initialized: Not authenticated");
      }

      if (linkedInDetector) {
        linkedInDetector.updateAuthState(authState);
      }
    })
    .catch((error: unknown) => {
      console.log("❌ Failed to get auth state on LinkedIn:", error);
      authState.isAuthenticated = false;
      authState.user = null;
    });
}

function cleanup(): void {
  if (linkedInDetector) {
    linkedInDetector.destroy();
    linkedInDetector = null;
  }
  console.log("🧹 LinkedIn cleanup completed");
}

function initializeWhenReady(): void {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    console.log("LinkedIn DOM ready, initializing immediately");
    initializeLinkedInExtension();
    return;
  }

  if (window.location.hostname.includes("linkedin.com")) {
    const checkLinkedInReady = (): void => {
      if (hasInitialized) {
        return;
      }
      if (document.querySelector(".scaffold-layout") || document.querySelector('[data-control-name]')) {
        console.log("LinkedIn app detected, initializing");
        initializeLinkedInExtension();
      } else {
        setTimeout(checkLinkedInReady, 500);
      }
    };

    if (document.readyState === "loading") {
      setTimeout(checkLinkedInReady, 100);
    } else {
      checkLinkedInReady();
    }
  }
}

// Global error handler
window.addEventListener('error', (e: ErrorEvent) => {
  console.error('💼 LinkedIn Extension Error:', e.error);
});

// Make detector available for debugging
(window as any).knuggetLinkedInDetector = () => linkedInDetector;

console.log("💼 Knugget LinkedIn content script loaded and ready");
initializeWhenReady();