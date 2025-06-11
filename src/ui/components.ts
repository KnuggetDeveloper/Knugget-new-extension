export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Enhanced element waiting with site-specific optimizations
export function waitForElement(
  selector: string,
  timeout: number = 10000,
  site?: 'youtube' | 'linkedin'
): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    // Set up mutation observer with site-specific optimizations
    const observerConfig = site === 'linkedin' 
      ? {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-id", "data-urn", "class"],
        }
      : {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id", "style"],
        };

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      console.warn(`Element not found within ${timeout}ms: ${selector}`);
      resolve(null);
    }, timeout);

    // Start observing
    observer.observe(document.body, observerConfig);
  });
}

// Enhanced click function with site-specific handling
export async function clickElement(element: Element, site?: 'youtube' | 'linkedin'): Promise<void> {
  if (!element) {
    console.warn("Cannot click null element");
    return;
  }

  try {
    // LinkedIn often requires different event handling
    if (site === 'linkedin') {
      // Scroll element into view first for LinkedIn
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(200);
    }

    // Method 1: Try native click for HTMLElements
    if (element instanceof HTMLElement) {
      element.click();
      return;
    }

    // Method 2: Dispatch comprehensive mouse events
    const events = [
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
      }),
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
      }),
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
      }),
    ];

    for (const event of events) {
      element.dispatchEvent(event);
      await wait(50);
    }

    // Method 3: Try focus and enter key for accessibility
    if (element instanceof HTMLElement) {
      element.focus();
      await wait(100);
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        })
      );
    }
  } catch (error) {
    console.error("Error clicking element:", error);
  }
}

// Create DOM element with enhanced options
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: {
    className?: string;
    id?: string;
    innerHTML?: string;
    textContent?: string;
    attributes?: Record<string, string>;
    styles?: Partial<CSSStyleDeclaration>;
    children?: (HTMLElement | string)[];
    dataset?: Record<string, string>; // NEW
  } = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (options.className) element.className = options.className;
  if (options.id) element.id = options.id;
  if (options.innerHTML) element.innerHTML = options.innerHTML;
  if (options.textContent) element.textContent = options.textContent;

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  if (options.styles) {
    Object.assign(element.style, options.styles);
  }

  // NEW: Dataset support for LinkedIn data attributes
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });
  }

  if (options.children) {
    options.children.forEach((child) => {
      if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
  }

  return element;
}

// Find ancestor element that matches selector
export function findAncestor(
  element: Element,
  selector: string
): Element | null {
  let current = element.parentElement;
  while (current) {
    if (current.matches(selector)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

// Enhanced debounce with site-specific delays
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; site?: 'youtube' | 'linkedin' } = {}
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  let lastCallTime = 0;
  
  // Adjust wait time based on site
  if (options.site === 'linkedin') {
    wait = Math.max(wait, 300); // LinkedIn needs longer debounce
  }

  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (options.leading && now - lastCallTime >= wait) {
      lastCallTime = now;
      func(...args);
    }
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      lastCallTime = now;
      func(...args);
    }, wait);
  };
}

// Enhanced video ID extraction with error handling
export function getVideoId(): string | null {
  try {
    // Method 1: URL parameter
    const url = new URL(window.location.href);
    let videoId = url.searchParams.get("v");

    if (videoId && videoId.length === 11) {
      return videoId;
    }

    // Method 2: YouTube shorts format
    const shortsMatch = window.location.pathname.match(
      /\/shorts\/([a-zA-Z0-9_-]{11})/
    );
    if (shortsMatch) {
      return shortsMatch[1];
    }

    // Method 3: Extract from page data
    const ytInitialData = (window as any).ytInitialData;
    if (ytInitialData?.currentVideoEndpoint?.watchEndpoint?.videoId) {
      const id = ytInitialData.currentVideoEndpoint.watchEndpoint.videoId;
      if (id && id.length === 11) return id;
    }

    // Method 4: Canonical URL
    const canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement;
    if (canonicalLink) {
      const canonicalUrl = new URL(canonicalLink.href);
      const canonicalVideoId = canonicalUrl.searchParams.get("v");
      if (canonicalVideoId && canonicalVideoId.length === 11) {
        return canonicalVideoId;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting video ID:', error);
    return null;
  }
}

// NEW: LinkedIn post ID extraction
export function getLinkedInPostId(element: Element): string | null {
  try {
    // Method 1: data-id attribute
    const dataId = element.getAttribute('data-id');
    if (dataId) return dataId;

    // Method 2: data-urn attribute
    const dataUrn = element.getAttribute('data-urn');
    if (dataUrn) return dataUrn;

    // Method 3: Extract from URL
    const links = element.querySelectorAll('a[href*="/posts/"]');
    for (const link of Array.from(links)) {
      const href = link.getAttribute('href');
      if (href) {
        const match = href.match(/\/posts\/([^/?]+)/);
        if (match) return match[1];
      }
    }

    // Method 4: Generate from content hash
    const textContent = element.textContent?.trim() || '';
    if (textContent.length > 10) {
      return btoa(textContent.substring(0, 50))
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 20);
    }

    return null;
  } catch (error) {
    console.error('Error extracting LinkedIn post ID:', error);
    return null;
  }
}

// NEW: Site detection utilities
export function detectCurrentSite(): 'youtube' | 'linkedin' | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();
  
  if (hostname.includes('youtube.com')) {
    return 'youtube';
  } else if (hostname.includes('linkedin.com')) {
    return 'linkedin';
  }
  
  return 'unknown';
}

// NEW: Check if current page is supported
export function isSupportedPage(): boolean {
  const site = detectCurrentSite();
  
  switch (site) {
    case 'youtube':
      return window.location.pathname === '/watch' && 
             window.location.search.includes('v=');
    case 'linkedin':
      const supportedPaths = ['/feed', '/in/', '/company/', '/posts/'];
      return supportedPaths.some(path => 
        window.location.pathname.includes(path)
      );
    default:
      return false;
  }
}

// Enhanced video metadata extraction
export function getVideoMetadata() {
  const videoId = getVideoId();
  if (!videoId) return null;

  // Enhanced title selectors for different YouTube layouts
  const titleSelectors = [
    "h1.ytd-watch-metadata #title",
    "h1.title",
    "#container h1",
    "ytd-watch-metadata h1",
    ".ytd-video-primary-info-renderer h1",
    'h1[class*="title"]',
    ".ytd-videoPrimaryInfoRenderer h1",
    "ytd-video-primary-info-renderer .title",
  ];

  let titleElement = null;
  let title = "Unknown Title";

  for (const selector of titleSelectors) {
    titleElement = document.querySelector(selector);
    if (titleElement?.textContent?.trim()) {
      title = titleElement.textContent.trim();
      break;
    }
  }

  // Enhanced channel selectors
  const channelSelectors = [
    "#top-row .ytd-channel-name a",
    "#channel-name a",
    "#owner-name a",
    "ytd-channel-name a",
    ".ytd-video-owner-renderer a",
    "ytd-video-owner-renderer .ytd-channel-name a",
    "#upload-info ytd-channel-name a",
    ".ytd-c4-tabbed-header-renderer .ytd-channel-name a",
  ];

  let channelElement = null;
  let channelName = "Unknown Channel";

  for (const selector of channelSelectors) {
    channelElement = document.querySelector(selector);
    if (channelElement?.textContent?.trim()) {
      channelName = channelElement.textContent.trim();
      break;
    }
  }

  // Duration extraction
  const videoPlayer = document.querySelector("video") as HTMLVideoElement;
  let duration = "";

  if (videoPlayer && videoPlayer.duration) {
    duration = formatDuration(videoPlayer.duration);
  }

  return {
    videoId,
    title,
    channelName,
    url: window.location.href,
    duration,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

// Format duration from seconds to readable format
function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// NEW: Throttle function for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// NEW: Check if element is visible in viewport
export function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}