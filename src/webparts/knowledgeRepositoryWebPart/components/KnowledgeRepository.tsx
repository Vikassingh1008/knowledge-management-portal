import * as React from 'react';
import styles from '../../../shared/portal.module.scss';
import { IArticle, IPortalProps } from '../../../shared/models';
import { SAMPLE_ARTICLES } from '../../../shared/sampleData';
import { formatLongDate, plainText, readQuery } from '../../../shared/format';
import { takePendingArticle } from '../../../shared/portalNav';
import { PortalService, pushLocalLog } from '../../../shared/portalService';
import { PortalChrome, readSaved, toggleSaved } from '../../../shared/PortalChrome';
import { requestApproval } from '../../../shared/teams';

export interface IKnowledgeRepositoryProps {
  portal: IPortalProps;
  framed?: boolean;
}

type SortKey = 'newest' | 'oldest' | 'name' | 'nameDesc' | 'views';

function withStatus(item: IArticle, status: string, published: boolean): IArticle {
  return {
    id: item.id,
    title: item.title,
    articleName: item.articleName,
    description: item.description,
    category: item.category,
    authorName: item.authorName,
    startDate: item.startDate,
    endDate: item.endDate,
    status: status,
    published: published,
    articleUrl: item.articleUrl,
    viewCount: item.viewCount,
    section: item.section,
    lastUpdated: item.lastUpdated,
    modified: item.modified
  };
}

export const KnowledgeRepository: React.FC<IKnowledgeRepositoryProps> = (props) => {
  const portal = props.portal;
  const [articles, setArticles] = React.useState<IArticle[]>([]);
  const [source, setSource] = React.useState('Loading articles');
  const [usingSample, setUsingSample] = React.useState(false);
  const [category, setCategory] = React.useState('All');
  const [status, setStatus] = React.useState('All');
  const [sort, setSort] = React.useState<SortKey>('newest');
  const [query, setQuery] = React.useState(readQuery('q') || readQuery('article'));
  const [selectedId, setSelectedId] = React.useState(0);
  const [pendingOpen, setPendingOpen] = React.useState(readQuery('article') || '');
  const [message, setMessage] = React.useState('');
  const [savedNames, setSavedNames] = React.useState<string[]>(readSaved());
  const [approvalBusy, setApprovalBusy] = React.useState(false);

  const load = React.useCallback(() => {
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    const showList = (rows: IArticle[]): void => {
      setArticles(rows);
      setUsingSample(false);
      setSource(rows.length ? 'Loaded from KnowledgeArticles' : 'KnowledgeArticles has no articles yet');
      window.dispatchEvent(new CustomEvent('kmp-articles-changed'));
    };
    const showSample = (): void => {
      setArticles(SAMPLE_ARTICLES);
      setUsingSample(true);
      setSource('Showing the 10 sample articles on this page because KnowledgeArticles could not be read');
    };
    const readOrSeed = (): Promise<void> => {
      return service.getArticles().then((rows) => {
        if (rows.length) {
          showList(rows);
          return;
        }
        return service.provision().then(() => service.getArticles()).then((seeded) => {
          if (seeded.length) {
            showList(seeded);
            return;
          }
          showSample();
        });
      });
    };
    readOrSeed().catch(() => {
      service.provision().then(() => service.getArticles()).then((seeded) => {
        if (seeded.length) {
          showList(seeded);
          return;
        }
        showSample();
      }).catch(() => showSample());
    });
  }, [portal.spHttpClient, portal.siteUrl]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const waiting = pendingOpen || takePendingArticle();
    if (!waiting) {
      return;
    }
    if (waiting !== pendingOpen) {
      setQuery(waiting);
      setPendingOpen(waiting);
    }
    const match = articles.filter((item) => item.articleName === waiting)[0];
    if (match) {
      setSelectedId(match.id);
      setPendingOpen('');
    }
  }, [articles, pendingOpen]);

  React.useEffect(() => {
    const onFind = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { query?: string; open?: boolean } | undefined;
      if (detail && detail.query !== undefined) {
        setQuery(detail.query);
        if (detail.open && detail.query) {
          setPendingOpen(detail.query);
        }
      }
    };
    window.addEventListener('kmp-search', onFind);
    const onSaved = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { names?: string[] } | undefined;
      setSavedNames(detail && detail.names ? detail.names : readSaved());
    };
    window.addEventListener('kmp-saved-changed', onSaved);
    return () => {
      window.removeEventListener('kmp-search', onFind);
      window.removeEventListener('kmp-saved-changed', onSaved);
    };
  }, []);

  React.useEffect(() => {
    if (!selectedId) {
      return;
    }
    const article = articles.filter((item) => item.id === selectedId)[0];
    if (!article) {
      return;
    }
    window.dispatchEvent(new CustomEvent('kmp-notice-read', { detail: { id: article.id } }));
    if (usingSample) {
      pushLocalLog(article, portal.userDisplayName);
      return;
    }
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    service.logAccess(article, portal.userDisplayName).catch(() => pushLocalLog(article, portal.userDisplayName));
  }, [selectedId]);

  const categories = ['All'];
  const statuses = ['All'];
  for (let i = 0; i < articles.length; i++) {
    if (articles[i].category && categories.indexOf(articles[i].category) < 0) {
      categories.push(articles[i].category);
    }
    if (articles[i].status && statuses.indexOf(articles[i].status) < 0) {
      statuses.push(articles[i].status);
    }
  }

  const visible = articles.filter((item) => {
    const blob = (item.articleName + ' ' + item.description + ' ' + item.authorName + ' ' + item.category).toLowerCase();
    const matchesQuery = !query || blob.indexOf(query.toLowerCase()) >= 0;
    const matchesCategory = category === 'All' || item.category === category;
    const matchesStatus = status === 'All' || item.status === status;
    return matchesQuery && matchesCategory && matchesStatus;
  }).sort((a, b) => {
    if (sort === 'name') return a.articleName.localeCompare(b.articleName);
    if (sort === 'nameDesc') return b.articleName.localeCompare(a.articleName);
    if (sort === 'views') return b.viewCount - a.viewCount;
    if (sort === 'oldest') return a.startDate.localeCompare(b.startDate);
    return b.startDate.localeCompare(a.startDate);
  });

  const selected = articles.filter((item) => item.id === selectedId)[0];

  const decide = (status: string, published: boolean | undefined, success: string): void => {
    if (!selected || approvalBusy) {
      return;
    }
    setApprovalBusy(true);
    setMessage('Saving ' + status + '.');
    const current = selected;
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    const writeStatus = usingSample
      ? Promise.reject(new Error('sample'))
      : service.updateStatus(current.id, status, published);
    writeStatus.then(() => {
      const next: IArticle[] = [];
      for (let i = 0; i < articles.length; i++) {
        const item = articles[i];
        next.push(item.id === current.id ? withStatus(item, status, published !== undefined ? published : item.published) : item);
      }
      setArticles(next);
      if (status !== 'Pending Approval') {
        setMessage(success);
        return undefined;
      }
      return requestApproval(portal, current).then(() => {
        setMessage(success + ' The approval card was posted to Teams.');
      }).catch(() => {
        setMessage(success);
      });
    }).catch((error: Error) => {
      const text = error && error.message ? error.message : '';
      setMessage(text === 'sample'
        ? 'This article is only on the page. Upload it to KnowledgeArticles before changing approval.'
        : 'The approval status could not be saved on KnowledgeArticles.');
    }).then(() => setApprovalBusy(false), () => setApprovalBusy(false));
  };

  const body = (
    <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Knowledge repository</p>
            <h1 className={styles.pageTitle}>Articles</h1>
          </div>
        </div>
        <p className={styles.banner} role="status">{source}. Open an article to record the access time for the dashboard.</p>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="filter-query">Search</label>
            <input id="filter-query" className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="filter-category">Category</label>
            <select id="filter-category" className={styles.select} value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="filter-status">Status</label>
            <select id="filter-status" className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="filter-sort">Sort</label>
            <select id="filter-sort" className={styles.select} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="newest">Start date, newest</option>
              <option value="oldest">Start date, oldest</option>
              <option value="name">Name, A to Z</option>
              <option value="nameDesc">Name, Z to A</option>
              <option value="views">Most viewed</option>
            </select>
          </div>
        </div>
        <p className={styles.live} aria-live="polite">{visible.length} articles</p>
        {message && <p role="status">{message}</p>}
        <div className={styles.articleGrid}>
          {visible.map((item) => (
            <article key={item.id} className={styles.articleCard}>
              <button className={styles.articleBody} type="button" onClick={() => setSelectedId(item.id)}>
                <p className={styles.kicker}>{item.category}</p>
                <h2 className={styles.cardTitle}>{item.articleName}</h2>
                <p>{plainText(item.description).substring(0, 160)}{plainText(item.description).length > 160 ? '…' : ''}</p>
                <p className={styles.meta}>
                  <span className={styles.tag}>{item.status}</span>
                  {' '}By {item.authorName || 'Unknown'} · {formatLongDate(item.startDate)} · {item.viewCount} views
                </p>
              </button>
            </article>
          ))}
        </div>
        {selected && (
          <div className={styles.backdrop} onClick={() => setSelectedId(0)}>
            <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="article-title" onClick={(event) => event.stopPropagation()}>
              <p className={styles.kicker}>{selected.category}</p>
              <h2 id="article-title">{selected.articleName}</h2>
              <p className={styles.meta}>By {selected.authorName} · {selected.status} · {formatLongDate(selected.startDate)} to {formatLongDate(selected.endDate)}</p>
              <p>{plainText(selected.description)}</p>
              {selected.section && <p>Section {selected.section}{selected.lastUpdated ? ' · Last updated ' + selected.lastUpdated : ''}</p>}
              <p>
                {selected.articleUrl && <a href={selected.articleUrl}>Open source link</a>}
              </p>
              {message && <p role="status">{message}</p>}
              <div className={styles.toolbar}>
                <button className={styles.btn} type="button" onClick={() => {
                  const next = toggleSaved(selected.articleName);
                  setSavedNames(next);
                  setMessage(next.indexOf(selected.articleName) >= 0
                    ? 'Saved. Open the cart icon to see ' + selected.articleName + '.'
                    : 'Removed from saved articles.');
                }}>{savedNames.indexOf(selected.articleName) >= 0 ? 'Remove saved' : 'Save article'}</button>
                {selected.status !== 'Pending Approval' && (
                  <button className={styles.btn} type="button" disabled={approvalBusy} onClick={() => decide('Pending Approval', undefined, 'Approval requested for ' + selected.articleName + '. Use Approve or Reject below.')}>Request approval</button>
                )}
                {selected.status === 'Pending Approval' && (
                  <button className={styles.btn} type="button" disabled={approvalBusy} onClick={() => decide('Approved', true, 'Approved by ' + (portal.userDisplayName || 'you') + '. The article is now approved content.')}>Approve</button>
                )}
                {selected.status === 'Pending Approval' && (
                  <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" disabled={approvalBusy} onClick={() => decide('Rejected', false, 'Rejected by ' + (portal.userDisplayName || 'you') + '. Request approval again if it should be reviewed.')}>Reject</button>
                )}
                <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={() => setSelectedId(0)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (props.framed === false) {
    return body;
  }
  return <PortalChrome portal={portal}>{body}</PortalChrome>;
};
