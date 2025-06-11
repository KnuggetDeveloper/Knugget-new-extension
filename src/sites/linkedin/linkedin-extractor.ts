import { PostData, AuthorData } from '../base/site-handler.interface';

export class LinkedInExtractor {
  private readonly selectors = {
    posts: [
      'div[data-id^="urn:li:activity"]',
      '.feed-shared-update-v2',
      'article.relative',
      '.organizations-entity-card',
      '[data-urn*="activity"]'
    ],
    content: [
      '.feed-shared-text',
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.break-words',
      '[data-test-id="main-feed-activity-card__commentary"]'
    ],
    author: {
      name: [
        '.feed-shared-actor__name',
        '.update-components-actor__name',
        '.artdeco-entity-lockup__title',
        '[data-test-id="main-feed-activity-card__actor-name"]'
      ],
      title: [
        '.feed-shared-actor__description',
        '.update-components-actor__description',
        '.artdeco-entity-lockup__subtitle'
      ],
      profileUrl: [
        '.feed-shared-actor__container-link',
        '.update-components-actor__container a',
        '.artdeco-entity-lockup__title a'
      ]
    },
    timestamp: [
      '.feed-shared-actor__sub-description time',
      '.update-components-actor__sub-description time',
      'time[datetime]',
      '.visually-hidden'
    ]
  };

  findAllPosts(): Element[] {
    const posts: Element[] = [];
    
    this.selectors.posts.forEach(selector => {
      const foundPosts = document.querySelectorAll(selector);
      foundPosts.forEach(post => {
        if (!posts.includes(post)) {
          posts.push(post);
        }
      });
    });
    
    return posts.filter(post => this.isValidPost(post));
  }

  private isValidPost(element: Element): boolean {
    // Check if it has content and author
    const hasContent = this.findElementBySelectors(element, this.selectors.content);
    const hasAuthor = this.findElementBySelectors(element, this.selectors.author.name);
    
    return !!(hasContent && hasAuthor);
  }

  getPostId(postElement: Element): string | null {
    // Try data attributes first
    const dataId = postElement.getAttribute('data-id');
    if (dataId) return dataId;
    
    const dataUrn = postElement.getAttribute('data-urn');
    if (dataUrn) return dataUrn;
    
    // Generate ID from position and content
    const content = this.extractContent(postElement);
    const author = this.extractAuthor(postElement);
    
    if (content && author.name) {
      return btoa(`${author.name}-${content.substring(0, 50)}`).replace(/[^a-zA-Z0-9]/g, '');
    }
    
    return null;
  }

  extractPostData(postElement: Element): PostData | null {
    try {
      const content = this.extractContent(postElement);
      const author = this.extractAuthor(postElement);
      const timestamp = this.extractTimestamp(postElement);
      const postId = this.getPostId(postElement);
      
      if (!content || !author.name || !postId) {
        console.warn('Missing required post data');
        return null;
      }
      
      return {
        id: postId,
        content,
        author,
        url: window.location.href,
        timestamp,
        type: 'linkedin',
        metadata: {
          extractedAt: new Date().toISOString(),
          pageType: this.detectPageType()
        }
      };
    } catch (error) {
      console.error('Error extracting post data:', error);
      return null;
    }
  }

  private extractContent(postElement: Element): string {
    const contentElement = this.findElementBySelectors(postElement, this.selectors.content);
    if (!contentElement) return '';
    
    // Clean up the content
    let content = contentElement.textContent?.trim() || '';
    
    // Remove "see more" and similar expansion text
    content = content.replace(/\.\.\.\s*(see more|show more)/gi, '');
    
    return content;
  }

  private extractAuthor(postElement: Element): AuthorData {
    const nameElement = this.findElementBySelectors(postElement, this.selectors.author.name);
    const titleElement = this.findElementBySelectors(postElement, this.selectors.author.title);
    const profileElement = this.findElementBySelectors(postElement, this.selectors.author.profileUrl);
    
    return {
      name: nameElement?.textContent?.trim() || 'Unknown Author',
      title: titleElement?.textContent?.trim(),
      profileUrl: profileElement?.getAttribute('href') || undefined
    };
  }

  private extractTimestamp(postElement: Element): string {
    const timeElement = this.findElementBySelectors(postElement, this.selectors.timestamp);
    
    if (timeElement) {
      // Try datetime attribute first
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) return datetime;
      
      // Fall back to text content
      const timeText = timeElement.textContent?.trim();
      if (timeText) return timeText;
    }
    
    return new Date().toISOString();
  }

  private findElementBySelectors(parent: Element, selectors: string[]): Element | null {
    for (const selector of selectors) {
      const element = parent.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  private detectPageType(): string {
    const pathname = window.location.pathname;
    
    if (pathname.includes('/feed/')) return 'feed';
    if (pathname.includes('/in/')) return 'profile';
    if (pathname.includes('/company/')) return 'company';
    if (pathname.includes('/posts/')) return 'post';
    
    return 'unknown';
  }
}