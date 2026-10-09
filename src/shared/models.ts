import { MSGraphClientFactory, SPHttpClient } from '@microsoft/sp-http';

export const DEFAULT_SITE_URL = 'https://holidaywiser.sharepoint.com/sites/KnowledgeManagementPortal';

export const LISTS = {
  articles: 'KnowledgeArticles',
  access: 'ArticleAccessLog'
};

export interface IPortalProperties {
  siteUrl: string;
  teamId?: string;
  channelId?: string;
}

export interface IPortalProps {
  siteUrl: string;
  spHttpClient: SPHttpClient;
  userDisplayName: string;
  userEmail: string;
  isSiteAdmin: boolean;
  activeNav: 'home' | 'knowledge' | 'dashboard' | 'assistant';
  teamId: string;
  channelId: string;
  msGraphClientFactory: MSGraphClientFactory;
}

export interface IArticle {
  id: number;
  title: string;
  articleName: string;
  description: string;
  category: string;
  authorName: string;
  startDate: string;
  endDate: string;
  status: string;
  published: boolean;
  articleUrl: string;
  viewCount: number;
  section: string;
  lastUpdated: string;
  modified: string;
}

export interface IArticleInput {
  articleName: string;
  description: string;
  category: string;
  authorName: string;
  startDate: string;
  endDate: string;
  status: string;
  published: boolean;
  articleUrl: string;
}

export interface IAccessLog {
  id: number;
  title: string;
  articleId: number;
  articleName: string;
  userName: string;
  accessDateTime: string;
  category: string;
}
