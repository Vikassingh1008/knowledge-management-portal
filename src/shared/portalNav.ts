export type PortalView = 'dashboard' | 'knowledge' | 'assistant';

let pendingArticle = '';

export function takePendingArticle(): string {
  const value = pendingArticle;
  pendingArticle = '';
  return value;
}

export interface IPortalOpenDetail {
  view: PortalView;
  article: string;
  scroll: string;
  source: string;
}

export function openPortalView(view: PortalView, article: string, scroll: string, source: string): void {
  if (article) {
    pendingArticle = article;
  }
  window.dispatchEvent(new CustomEvent('kmp-open', {
    detail: { view: view, article: article, scroll: scroll, source: source }
  }));
  if (article) {
    window.dispatchEvent(new CustomEvent('kmp-search', { detail: { query: article, open: true } }));
  }
}

export function hostSource(node: Element): string {
  const host = node.closest('[data-kmp-host]');
  return host ? host.getAttribute('data-kmp-host') || '' : '';
}
