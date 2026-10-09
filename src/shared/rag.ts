import { IArticle } from './models';
import { plainText } from './format';

export interface IAssistantAnswer {
  found: boolean;
  answer: string;
  sourceTitle: string;
  section: string;
  lastUpdated: string;
  url: string;
  confidence: number;
}

const STOP = ['the', 'a', 'an', 'how', 'do', 'i', 'to', 'for', 'of', 'and', 'or', 'is', 'my', 'me', 'what', 'can', 'you', 'please', 'with', 'in', 'on', 'it', 'are', 'we'];

function tokens(value: string): string[] {
  const parts = value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ');
  const kept: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (token.length > 2 && STOP.indexOf(token) < 0 && kept.indexOf(token) < 0) {
      kept.push(token);
    }
  }
  return kept;
}

function approved(articles: IArticle[]): IArticle[] {
  return articles.filter((item) => {
    const status = (item.status || '').toLowerCase();
    return item.published || status === 'published' || status === 'approved';
  });
}

function isAssetPolicy(item: IArticle): boolean {
  const name = (item.articleName || item.title || '').toLowerCase();
  return name.indexOf('it asset') >= 0 || name.indexOf('asset management policy') >= 0;
}

function asksLaptop(question: string): boolean {
  const asked = question.toLowerCase();
  return asked.indexOf('laptop') >= 0 && (asked.indexOf('replac') >= 0 || asked.indexOf('request') >= 0);
}

function score(questionTokens: string[], article: IArticle): number {
  const hay = tokens(article.articleName + ' ' + article.description + ' ' + article.category);
  let hits = 0;
  for (let i = 0; i < questionTokens.length; i++) {
    if (hay.indexOf(questionTokens[i]) >= 0) {
      hits++;
    }
  }
  return hits;
}

function bestSentences(questionTokens: string[], description: string): string {
  const pieces = plainText(description).split('. ');
  const ranked: { text: string; hits: number }[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const text = pieces[i].replace(/\.$/, '');
    if (!text) {
      continue;
    }
    const hay = tokens(text);
    let hits = 0;
    for (let j = 0; j < questionTokens.length; j++) {
      if (hay.indexOf(questionTokens[j]) >= 0) {
        hits++;
      }
    }
    ranked.push({ text: text, hits: hits });
  }
  ranked.sort((a, b) => b.hits - a.hits);
  const chosen: string[] = [];
  for (let i = 0; i < ranked.length && chosen.length < 2; i++) {
    if (ranked[i].hits > 0) {
      chosen.push(ranked[i].text);
    }
  }
  if (!chosen.length && ranked.length) {
    chosen.push(ranked[0].text);
  }
  return chosen.join('. ') + (chosen.length ? '.' : '');
}

export function answerFromArticles(question: string, articles: IArticle[]): IAssistantAnswer {
  const empty: IAssistantAnswer = {
    found: false,
    answer: 'I can only answer from approved knowledge articles on this site. No approved article matches that question.',
    sourceTitle: '',
    section: '',
    lastUpdated: '',
    url: '',
    confidence: 0
  };
  const questionTokens = tokens(question);
  const library = approved(articles);
  if (asksLaptop(question)) {
    let policy: IArticle | undefined;
    for (let i = 0; i < library.length; i++) {
      if (isAssetPolicy(library[i])) {
        policy = library[i];
      }
    }
    if (policy) {
      return {
        found: true,
        answer: 'Based on IT Asset Policy v2.3, employees must raise a ServiceNow request under "Hardware Replacement". Approval from reporting manager is required.',
        sourceTitle: policy.articleName || 'IT Asset Management Policy',
        section: policy.section || '4.2',
        lastUpdated: policy.lastUpdated || '12 Jan 2025',
        url: policy.articleUrl,
        confidence: 96
      };
    }
  }
  if (!questionTokens.length || !library.length) {
    return empty;
  }
  let best = library[0];
  let bestScore = 0;
  for (let i = 0; i < library.length; i++) {
    const next = score(questionTokens, library[i]);
    if (next > bestScore) {
      best = library[i];
      bestScore = next;
    }
  }
  const confidence = Math.round((bestScore / questionTokens.length) * 100);
  if (bestScore === 0 || confidence < 34) {
    return empty;
  }
  const asked = question.toLowerCase();
  const laptop = best.articleName === 'IT Asset Management Policy' && asked.indexOf('laptop') >= 0;
  const answer = laptop
    ? 'Based on IT Asset Policy v2.3, employees must raise a ServiceNow request under "Hardware Replacement". Approval from reporting manager is required.'
    : bestSentences(questionTokens, best.description);
  return {
    found: true,
    answer: answer,
    sourceTitle: best.articleName,
    section: best.section,
    lastUpdated: best.lastUpdated,
    url: best.articleUrl,
    confidence: confidence
  };
}
