export interface SiteHandler {
    initialize(): Promise<void>;
    cleanup(): void;
    getSiteName(): string;
  }
  
  export interface PostData {
    id: string;
    content: string;
    author: AuthorData;
    url: string;
    timestamp: string;
    type: 'youtube' | 'linkedin';
    metadata?: Record<string, any>;
  }
  
  export interface AuthorData {
    name: string;
    profileUrl?: string;
    title?: string;
    avatar?: string;
  }