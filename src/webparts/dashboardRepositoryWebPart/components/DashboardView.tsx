import * as React from 'react';
import styles from '../../../shared/portal.module.scss';
import { IAccessLog, IArticle, IPortalProps } from '../../../shared/models';
import { formatDateTime, formatLongDate } from '../../../shared/format';
import { hostSource, openPortalView } from '../../../shared/portalNav';
import { PortalService, readLocalLogs } from '../../../shared/portalService';
import { announceNewArticles } from '../../../shared/teams';
import { SAMPLE_ARTICLES } from '../../../shared/sampleData';
import { PortalChrome } from '../../../shared/PortalChrome';
import banner from '../../../shared/assets/banner.jpg';
import programs from '../../../shared/assets/programs.png';
import portrait from '../../../shared/assets/portrait.png';
import blogSkills from '../../../shared/assets/blog-skills.png';
import blogRemote from '../../../shared/assets/blog-remote.png';
import blogWeb from '../../../shared/assets/blog-web.png';

export interface IDashboardViewProps {
  portal: IPortalProps;
  framed?: boolean;
}

interface ICount {
  label: string;
  value: number;
}

interface IUploadRow {
  name: string;
  category: string;
  state: string;
}

const cardImages = [blogSkills, blogRemote, blogWeb];

function cardImage(name: string, index: number): string {
  const lower = name.toLowerCase();
  if (lower.indexOf('skill') >= 0) {
    return blogSkills;
  }
  if (lower.indexOf('remote') >= 0) {
    return blogRemote;
  }
  if (lower.indexOf('leonardo') >= 0 || lower.indexOf('web design') >= 0) {
    return blogWeb;
  }
  return cardImages[index % cardImages.length];
}

function CheckList(props: { items: string[] }): React.ReactElement {
  return (
    <ul className={styles.checks}>
      {props.items.map((item) => (
        <li key={item} className={styles.check}>
          <span className={styles.checkIcon} aria-hidden="true">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function counts(logs: IAccessLog[], key: 'category' | 'day'): ICount[] {
  const map: { [name: string]: number } = {};
  for (let i = 0; i < logs.length; i++) {
    const label = key === 'category'
      ? (logs[i].category || 'Uncategorised')
      : (logs[i].accessDateTime || '').substring(0, 10);
    if (!label) {
      continue;
    }
    map[label] = (map[label] || 0) + 1;
  }
  const rows: ICount[] = [];
  for (const label in map) {
    if (Object.prototype.hasOwnProperty.call(map, label)) {
      rows.push({ label: label, value: map[label] });
    }
  }
  rows.sort((a, b) => key === 'day' ? a.label.localeCompare(b.label) : b.value - a.value);
  return rows;
}

function BarChart(props: { title: string; rows: ICount[] }): React.ReactElement {
  const max = props.rows.reduce((peak, row) => row.value > peak ? row.value : peak, 1);
  const width = 520;
  const height = Math.max(160, props.rows.length * 36);
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.cardTitle}>{props.title}</figcaption>
      {props.rows.length === 0 && <p>No access records yet.</p>}
      <svg role="img" aria-label={props.title} width="100%" viewBox={'0 0 ' + width + ' ' + height}>
        {props.rows.map((row, index) => {
          const bar = Math.max(4, (row.value / max) * 300);
          const y = index * 36 + 8;
          return (
            <g key={row.label}>
              <text x="0" y={y + 16} fontSize="13" fill="#243044">{row.label} ({row.value})</text>
              <rect x="190" y={y} width={bar} height="18" rx="4" fill="#1f4e9d" />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export const DashboardView: React.FC<IDashboardViewProps> = (props) => {
  const portal = props.portal;
  const openKnowledge = (event: React.MouseEvent<HTMLAnchorElement>, articleName: string): void => {
    event.preventDefault();
    openPortalView('knowledge', articleName, '', hostSource(event.currentTarget));
  };
  const [articles, setArticles] = React.useState<IArticle[]>([]);
  const [logs, setLogs] = React.useState<IAccessLog[]>([]);
  const [source, setSource] = React.useState('Loading dashboard');
  const [updated, setUpdated] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [report, setReport] = React.useState<IUploadRow[]>([]);
  const [reportOpen, setReportOpen] = React.useState(false);
  const uploadHost = React.useRef('');

  const load = React.useCallback(() => {
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    const writeArticles = (rows: IArticle[]): Promise<IArticle[]> => {
      if (rows.length) {
        return Promise.resolve(rows);
      }
      setSource('Writing 10 articles to KnowledgeArticles');
      return service.provision().then((notes) => {
        const note = notes.join(' ');
        return service.getArticles().then((created) => {
          if (note.indexOf('Added ') < 0) {
            setMessage(note);
            return created;
          }
          return announceNewArticles(portal, created).then((teamsNote) => {
            setMessage(note + ' ' + teamsNote);
            return created;
          });
        });
      }).catch(() => {
        setMessage('');
        return rows;
      });
    };
    const articlesPromise = service.getArticles().then((rows) => {
      return writeArticles(rows);
    }).catch(() => {
      return writeArticles([]);
    });
    const logsPromise = service.getAccessLogs().then((rows) => {
      setSource('Live SharePoint access log');
      return rows;
    }).catch(() => {
      setSource('Session access log, until the SharePoint lists are created');
      return readLocalLogs();
    });
    Promise.all([articlesPromise, logsPromise]).then((result) => {
      setArticles(result[0]);
      setLogs(result[1]);
      window.dispatchEvent(new CustomEvent('kmp-articles-changed'));
      setUpdated(new Date().toISOString());
      const articleText = result[0].length
        ? result[0].length + ' articles from KnowledgeArticles'
        : 'KnowledgeArticles has no articles yet';
      const logText = result[1].length ? result[1].length + ' rows in ArticleAccessLog' : 'no rows in ArticleAccessLog yet';
      setSource(articleText + '. ' + logText);
    }).catch(() => setSource('Dashboard data could not be loaded'));
  }, [portal.spHttpClient, portal.siteUrl]);

  React.useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        load();
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const upload = (node: HTMLElement): void => {
    setBusy(true);
    setReportOpen(false);
    setMessage('Writing the 10 sample articles into KnowledgeArticles.');
    uploadHost.current = hostSource(node);
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    const beforeNames: string[] = [];
    service.getArticles().then((before) => {
      for (let i = 0; i < before.length; i++) {
        beforeNames.push(before[i].articleName);
      }
    }).catch(() => undefined).then(() => {
      return service.provision();
    }).then(() => {
      return service.getArticles();
    }).then((after) => {
      const rows: IUploadRow[] = [];
      const added: IArticle[] = [];
      for (let i = 0; i < SAMPLE_ARTICLES.length; i++) {
        const sample = SAMPLE_ARTICLES[i];
        let match: IArticle | undefined;
        for (let j = 0; j < after.length; j++) {
          if (after[j].articleName === sample.articleName) {
            match = after[j];
          }
        }
        const wasThere = beforeNames.indexOf(sample.articleName) >= 0;
        if (match && !wasThere) {
          added.push(match);
        }
        rows.push({
          name: sample.articleName,
          category: sample.category,
          state: match ? (wasThere ? 'Already in the list' : 'Added') : 'Not saved'
        });
      }
      setReport(rows);
      setReportOpen(true);
      if (added.length) {
        window.dispatchEvent(new CustomEvent('kmp-new-articles', { detail: { articles: added } }));
      }
      setMessage(added.length
        ? 'Added ' + added.length + ' articles. They are published, so filter and sort can use them.'
        : 'All 10 sample articles are already in KnowledgeArticles.');
      setBusy(false);
      load();
      if (!added.length) {
        return undefined;
      }
      return announceNewArticles(portal, added).then((teamsNote) => {
        setMessage('Added ' + added.length + ' articles. Each new one shows on the bell until you open it. ' + teamsNote);
      }).catch(() => undefined);
    }).catch(() => {
      setBusy(false);
      setReportOpen(false);
      setMessage('The articles could not be uploaded. Confirm you can add items to KnowledgeArticles, then try again.');
    });
  };

  const publishedArticles = articles.filter((item) => item.published || item.status === 'Published' || !item.status);
  const news = (publishedArticles.length ? publishedArticles : articles).slice().sort((a, b) => {
    const left = a.startDate || a.modified;
    const right = b.startDate || b.modified;
    return right.localeCompare(left);
  }).slice(0, 3);
  const published = publishedArticles.length;
  const views = articles.reduce((sum, item) => sum + (item.viewCount || 0), 0);
  const readers: string[] = [];
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].userName && readers.indexOf(logs[i].userName) < 0) {
      readers.push(logs[i].userName);
    }
  }
  const pending = articles.filter((item) => item.status === 'Pending Approval').length;
  const byCategory = counts(logs, 'category');
  const byDay = counts(logs, 'day').slice(-7);

  const body = (
    <React.Fragment>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGrid}>
          <div className={styles.heroCard}>
            <span className={styles.badge}>100% Satisfaction Guarantee</span>
            <h1 id="hero-title" className={styles.heroTitle}>Start Your Learning Journey Today</h1>
            <p className={styles.lead}>Growth with our comprehensive online learning platform. Whether you are looking to advance your career or explore new interests, start with the knowledge your team already trusts.</p>
          </div>
          <img className={styles.heroImage} src={banner} alt="Colleague smiling while working on a laptop" />
        </div>
      </section>
      <section className={styles.band} id="programs" aria-labelledby="programs-title">
        <div className={styles.split}>
          <img className={styles.visual} src={programs} alt="" />
          <div>
            <p className={styles.eyebrow}>Get To Know About Us</p>
            <h2 id="programs-title" className={styles.sectionTitle}>Discover Our Online Learning Programs</h2>
            <p className={styles.lead}>Dive into a rich array of courses meticulously crafted to cater to your educational aspirations and professional growth. Explore diverse subjects, from business operations to security and technology.</p>
            <CheckList items={['Seamless Scheduling', 'Service Guarantee', 'Integrated Collaboration']} />
            <a className={styles.btn} href="#knowledge" onClick={(event) => openKnowledge(event, '')}>Discover more</a>
          </div>
        </div>
      </section>
      <section className={styles.news} aria-labelledby="news-title">
        <div className={styles.newsInner}>
          <p className={styles.eyebrow}>Get To Know About Us</p>
          <h2 id="news-title" className={styles.sectionTitle}>Our Latest News &amp; Blog</h2>
          <p className={styles.lead}>Explore insightful articles, industry trends, and exciting updates curated just for you.</p>
          <div className={styles.cardGrid}>
            {news.map((post, index) => (
              <article key={post.id + '-' + post.articleName} className={styles.card}>
                <img className={styles.cardImage} src={cardImage(post.articleName, index)} alt="" />
                <div className={styles.cardBody}>
                  <p className={styles.kicker}>{post.category || 'Knowledge'}</p>
                  <h3 className={styles.cardTitle}>
                    <a href="#knowledge" onClick={(event) => openKnowledge(event, post.articleName)}>{post.articleName}</a>
                  </h3>
                  <p className={styles.meta}>By {post.authorName || 'Unknown'} · {formatLongDate(post.startDate || post.modified)}</p>
                </div>
              </article>
            ))}
          </div>
          {news.length === 0 && <p role="status">{message || 'Loading articles from KnowledgeArticles.'}</p>}
        </div>
      </section>
      <section className={styles.band} id="courses" aria-labelledby="courses-title">
        <div className={styles.split}>
          <div>
            <p className={styles.eyebrow}>Get To Know About Us</p>
            <h2 id="courses-title" className={styles.sectionTitle}>Find Your Path with Our Online Courses</h2>
            <p className={styles.lead}>Embark on a personalized journey of growth and discovery with our online courses. Whether you are charting a new career path or seeking to expand your skills, start from an approved article.</p>
            <CheckList items={['Personalized Learning Paths', 'Interactive Course Materials', 'Expert Instructor Support']} />
            <a className={styles.btn} href="#knowledge" onClick={(event) => openKnowledge(event, '')}>Discover More</a>
          </div>
          <img className={styles.visual} src={portrait} alt="Smiling colleague with folded arms" />
        </div>
      </section>
      <section className={styles.page} id="activity" aria-labelledby="activity-title">
        <div className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Dashboard</p>
            <h2 id="activity-title" className={styles.pageTitle}>Knowledge activity</h2>
          </div>
          <div className={styles.toolbar}>
            <button className={styles.btn} type="button" disabled={busy} onClick={(event) => upload(event.currentTarget)}>{busy ? 'Uploading…' : 'Upload 10 sample articles'}</button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={load}>Refresh</button>
          </div>
        </div>
        <p className={styles.banner} role="status">{source}{updated ? '. Updated ' + formatDateTime(updated) : ''}. This view refreshes every 20 seconds.</p>
        <p className={styles.meta}>This button writes 10 differently named articles into KnowledgeArticles, marks them Published, refreshes the dashboard, and lists each result.</p>
        {message && <p role="status">{message}</p>}
        <div className={styles.kpiRow}>
          <article className={styles.kpi}><h3 className={styles.kicker}>Articles</h3><p className={styles.kpiValue}>{articles.length}</p></article>
          <article className={styles.kpi}><h3 className={styles.kicker}>Published</h3><p className={styles.kpiValue}>{published}</p></article>
          <article className={styles.kpi}><h3 className={styles.kicker}>Views</h3><p className={styles.kpiValue}>{views}</p></article>
          <article className={styles.kpi}><h3 className={styles.kicker}>Readers / pending</h3><p className={styles.kpiValue}>{readers.length}<span className={styles.meta}> / {pending} pending</span></p></article>
        </div>
        <div className={styles.dashGrid}>
          <BarChart title="Opens by category" rows={byCategory} />
          <BarChart title="Opens by day" rows={byDay} />
        </div>
        <div className={styles.chart} style={{ marginTop: 16 }}>
          <h3 className={styles.cardTitle}>Latest access</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>People opening knowledge articles</caption>
              <thead>
                <tr><th>When</th><th>Article</th><th>Category</th><th>Person</th></tr>
              </thead>
              <tbody>
                {logs.slice(0, 12).map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.accessDateTime)}</td>
                    <td>{log.articleName}</td>
                    <td>{log.category}</td>
                    <td>{log.userName}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={4}>Open an article in the knowledge repository to capture a row here.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {reportOpen && (
        <div className={styles.backdrop} onClick={() => setReportOpen(false)}>
          <div className={`${styles.dialog} ${styles.askDialog}`} role="dialog" aria-modal="true" aria-labelledby="upload-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="upload-title">10 sample articles</h2>
            <p>{message}</p>
            <ul>
              {report.map((row) => (
                <li key={row.name}>{row.category}: {row.name} — {row.state}</li>
              ))}
            </ul>
            <div className={styles.toolbar}>
              <button className={styles.btn} type="button" onClick={() => { setReportOpen(false); openPortalView('knowledge', '', '', uploadHost.current); }}>View in Knowledge repository</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={() => setReportOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );

  if (props.framed === false) {
    return body;
  }
  return <PortalChrome portal={portal}>{body}</PortalChrome>;
};
