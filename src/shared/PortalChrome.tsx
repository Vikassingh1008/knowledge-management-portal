import * as React from 'react';
import styles from './portal.module.scss';
import { IArticle, IPortalProps } from './models';
import { plainText } from './format';
import { hostSource, openPortalView, PortalView } from './portalNav';
import { PortalService } from './portalService';
import logo from './assets/logo.png';
import searchIcon from './assets/search.png';
import bellIcon from './assets/bell.png';
import bellHover from './assets/bell-hover.png';
import cartIcon from './assets/cart.png';
import cartHover from './assets/cart-hover.png';
import profileIcon from './assets/profile.png';

const AssistantPanel = React.lazy(() => import(/* webpackChunkName: 'knowledge-assistant' */ './KnowledgeAssistant').then((module) => ({ default: module.KnowledgeAssistant })));

export interface IPortalChromeProps {
  portal: IPortalProps;
  children?: React.ReactNode;
}

const NOTICE_SEEN = 'kmp-seen-articles';
const TICKET_KEY = 'kmp-tickets';

interface ITicket {
  id: number;
  topic: string;
  details: string;
  status: string;
  when: string;
  user: string;
}

function readTickets(): ITicket[] {
  try {
    const raw = window.localStorage.getItem(TICKET_KEY);
    return raw ? JSON.parse(raw) as ITicket[] : [];
  } catch {
    return [];
  }
}

function readIds(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as number[] : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]): void {
  window.localStorage.setItem(key, JSON.stringify(ids));
}

function markSeen(id: number): void {
  const seen = readIds(NOTICE_SEEN);
  if (seen.indexOf(id) < 0) {
    writeIds(NOTICE_SEEN, seen.concat([id]));
  }
}

export const PortalChrome: React.FC<IPortalChromeProps> = (props) => {
  const portal = props.portal;
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState('');
  const [bellOn, setBellOn] = React.useState(false);
  const [cartOn, setCartOn] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [saved, setSaved] = React.useState<string[]>(readSaved());
  const [ticketTopic, setTicketTopic] = React.useState('Hardware replacement');
  const [ticketDetails, setTicketDetails] = React.useState('');
  const [ticketNote, setTicketNote] = React.useState('');
  const [tickets, setTickets] = React.useState<ITicket[]>([]);
  const [notices, setNotices] = React.useState<IArticle[]>([]);
  const [catalog, setCatalog] = React.useState<IArticle[]>([]);
  const [hits, setHits] = React.useState<IArticle[]>([]);
  const [picked, setPicked] = React.useState<IArticle | undefined>(undefined);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const bellRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    setSaved(readSaved());
    setTickets(readTickets().filter((item) => item.user === portal.userDisplayName));
    const onSaved = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { names?: string[] } | undefined;
      setSaved(detail && detail.names ? detail.names : readSaved());
    };
    window.addEventListener('kmp-saved-changed', onSaved);
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    const addNotices = (items: IArticle[]): void => {
      const seen = readIds(NOTICE_SEEN);
      setNotices((current) => {
        const next = current.slice();
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (seen.indexOf(item.id) >= 0) {
            continue;
          }
          let exists = false;
          for (let j = 0; j < next.length; j++) {
            if (next[j].id === item.id) {
              exists = true;
            }
          }
          if (!exists) {
            next.unshift(item);
          }
        }
        return next;
      });
    };
    const pull = (): void => {
      service.getArticles().then((rows) => {
        setCatalog(rows);
        const seen = readIds(NOTICE_SEEN);
        const unseen: IArticle[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (seen.indexOf(rows[i].id) < 0) {
            unseen.push(rows[i]);
          }
        }
        setNotices(unseen);
      }).catch(() => undefined);
    };
    const onNew = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { articles?: IArticle[] } | undefined;
      addNotices(detail && detail.articles ? detail.articles : []);
    };
    const onRead = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { id?: number } | undefined;
      if (!detail || !detail.id) {
        return;
      }
      markSeen(detail.id);
      setNotices((current) => current.filter((item) => item.id !== detail.id));
    };
    pull();
    const onChanged = (): void => pull();
    window.addEventListener('kmp-articles-changed', onChanged);
    window.addEventListener('kmp-new-articles', onNew);
    window.addEventListener('kmp-notice-read', onRead);
    const timer = window.setInterval(pull, 15000);
    return () => {
      window.removeEventListener('kmp-articles-changed', onChanged);
      window.removeEventListener('kmp-new-articles', onNew);
      window.removeEventListener('kmp-notice-read', onRead);
      window.removeEventListener('kmp-saved-changed', onSaved);
      window.clearInterval(timer);
    };
  }, [portal.spHttpClient, portal.siteUrl, portal.userDisplayName]);

  React.useEffect(() => {
    if (open && closeRef.current) {
      closeRef.current.focus();
    }
  }, [open]);

  const findArticles = (value: string): IArticle[] => {
    const needle = value.toLowerCase();
    return catalog.filter((item) => {
      const blob = (item.articleName + ' ' + item.category + ' ' + item.authorName + ' ' + item.description).toLowerCase();
      return !needle || blob.indexOf(needle) >= 0;
    }).slice(0, 8);
  };

  const submitTicket = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const details = ticketDetails.replace(/^\s+|\s+$/g, '');
    if (!ticketTopic || !details) {
      setTicketNote('Choose a topic and describe the request.');
      return;
    }
    const ticket: ITicket = {
      id: new Date().getTime(),
      topic: ticketTopic,
      details: details,
      status: 'Submitted',
      when: new Date().toISOString(),
      user: portal.userDisplayName
    };
    const next = [ticket].concat(readTickets()).slice(0, 20);
    window.localStorage.setItem(TICKET_KEY, JSON.stringify(next));
    setTickets(next.filter((item) => item.user === portal.userDisplayName));
    setTicketDetails('');
    setTicketNote(ticketTopic === 'Hardware replacement'
      ? 'Ticket ' + ticket.id + ' is submitted. Raise the laptop request in ServiceNow under Hardware Replacement. Approval from the reporting manager is required.'
      : 'Ticket ' + ticket.id + ' is submitted.');
  };

  const openNotice = (item: IArticle): void => {
    markSeen(item.id);
    setNotices((current) => current.filter((notice) => notice.id !== item.id));
    setOpen('');
    openPortalView('knowledge', item.articleName, '', bellRef.current ? hostSource(bellRef.current) : '');
  };

  const onSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!searchOpen) {
      setSearchOpen(true);
      window.setTimeout(() => {
        if (searchRef.current) {
          searchRef.current.focus();
        }
      }, 0);
      return;
    }
    const value = query.replace(/^\s+|\s+$/g, '');
    setHits(findArticles(value));
    setPicked(undefined);
    setOpen('search');
    window.dispatchEvent(new CustomEvent('kmp-search', { detail: { query: value } }));
  };

  const links: { key: PortalView | 'home' | 'overview'; label: string; view: PortalView; scroll: string }[] = [
    { key: 'home', label: 'Home', view: 'dashboard', scroll: 'top' },
    { key: 'overview', label: 'Overview', view: 'dashboard', scroll: 'programs' },
    { key: 'dashboard', label: 'Dashboard', view: 'dashboard', scroll: 'activity' },
    { key: 'knowledge', label: 'Knowledge repository', view: 'knowledge', scroll: '' },
    { key: 'assistant', label: 'Assistant', view: 'assistant', scroll: '' }
  ];

  const openView = (event: React.MouseEvent<HTMLElement>, view: PortalView, scroll: string, article: string): void => {
    event.preventDefault();
    openPortalView(view, article, scroll, hostSource(event.currentTarget));
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <a className={styles.brand} href="#dashboard" onClick={(event) => openView(event, 'dashboard', 'top', '')}>
          <img src={logo} alt="Capgemini" />
        </a>
        <div className={styles.headerRight}>
          <div className={styles.tools}>
            <form className={searchOpen ? `${styles.searchForm} ${styles.searchFormOpen}` : styles.searchForm} role="search" onSubmit={onSearch}>
              <label className={styles.srOnly} htmlFor="portal-search">Search knowledge articles</label>
              <input
                ref={searchRef}
                id="portal-search"
                className={searchOpen ? styles.searchInput : styles.searchInputClosed}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search articles"
                tabIndex={searchOpen ? 0 : -1}
              />
              <button className={styles.searchBtn} type="submit" aria-expanded={searchOpen}>
                <img src={searchIcon} alt="" />
                <span className={styles.srOnly}>Search</span>
              </button>
            </form>
            <button className={styles.ticketBtn} type="button" onClick={() => setOpen('ticket')}>
              Raise a Ticket ▾
            </button>
            <div className={styles.noticeWrap}>
              <button
                className={styles.iconBtn}
                type="button"
                aria-label={saved.length ? 'Saved articles, ' + saved.length : 'Saved articles'}
                aria-expanded={open === 'saved'}
                aria-haspopup="dialog"
                onMouseEnter={() => setCartOn(true)}
                onMouseLeave={() => setCartOn(false)}
                onFocus={() => setCartOn(true)}
                onBlur={() => setCartOn(false)}
                onClick={() => setOpen(open === 'saved' ? '' : 'saved')}
              >
                <img src={cartOn ? cartHover : cartIcon} alt="" />
                {saved.length > 0 && <span className={styles.noticeCount}>{saved.length > 9 ? '9+' : saved.length}</span>}
              </button>
              {open === 'saved' && (
                <div className={styles.noticePanel} role="dialog" aria-label="Saved articles">
                  <div className={styles.noticeHead}>
                    <span>Saved articles</span>
                    <button ref={closeRef} className={styles.textBtn} type="button" onClick={() => setOpen('')}>Close</button>
                  </div>
                  {saved.length === 0 && <p className={styles.noticeEmpty}>No saved articles yet. Use Save article on an article.</p>}
                  {saved.map((name) => (
                    <div key={name}>
                      <button className={styles.noticeItem} type="button" onClick={(event) => { setOpen(''); openView(event, 'knowledge', '', name); }}>
                        <span className={styles.noticeTitle}>{name}</span>
                        <span className={styles.noticeMeta}>Saved · Open</span>
                      </button>
                      <button className={styles.textBtn} type="button" onClick={() => toggleSaved(name)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.noticeWrap}>
              <button
                ref={bellRef}
                className={styles.iconBtn}
                type="button"
                aria-label={notices.length ? 'Notifications, ' + notices.length + ' new' : 'Notifications'}
                aria-expanded={open === 'alerts'}
                aria-haspopup="dialog"
                onMouseEnter={() => setBellOn(true)}
                onMouseLeave={() => setBellOn(false)}
                onFocus={() => setBellOn(true)}
                onBlur={() => setBellOn(false)}
                onClick={() => setOpen(open === 'alerts' ? '' : 'alerts')}
              >
                <img src={bellOn ? bellHover : bellIcon} alt="" />
                {notices.length > 0 && <span className={styles.noticeCount}>{notices.length > 9 ? '9+' : notices.length}</span>}
              </button>
              {open === 'alerts' && (
                <div className={styles.noticePanel} role="dialog" aria-label="Notifications">
                  <div className={styles.noticeHead}>
                    <span>Notifications</span>
                    <button ref={closeRef} className={styles.textBtn} type="button" onClick={() => setOpen('')}>Close</button>
                  </div>
                  {notices.length === 0 && <p className={styles.noticeEmpty}>No new articles.</p>}
                  {notices.map((item) => (
                    <button key={item.id} className={styles.noticeItem} type="button" onClick={() => openNotice(item)}>
                      <span className={styles.noticeTitle}>{item.articleName}</span>
                      <span className={styles.noticeMeta}>{item.category || 'Article'} · New</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className={styles.iconBtn} type="button" aria-label="Your profile" aria-expanded={open === 'profile'} onClick={() => setOpen(open === 'profile' ? '' : 'profile')}>
              <img src={profileIcon} alt="" />
            </button>
          </div>
          <nav className={styles.nav} aria-label="Primary">
            {links.map((link) => (
              <a
                key={link.key}
                className={styles.navLink}
                href={'#' + link.view}
                aria-current={portal.activeNav === link.key ? 'page' : undefined}
                onClick={(event) => openView(event, link.view, link.scroll, '')}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      {open === 'search' && (
        <div className={styles.panel} role="dialog" aria-label="Search results">
          <button ref={closeRef} className={styles.textBtn} type="button" onClick={() => setOpen('')}>Close</button>
          {hits.length === 0 && <p>No articles match that search.</p>}
          <ul>
            {hits.map((item) => (
              <li key={item.id}>
                <button className={styles.textBtn} type="button" onClick={() => setPicked(item)}>
                  {item.articleName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {picked && (
        <div className={styles.backdrop} onClick={() => setPicked(undefined)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="search-article-title" onClick={(event) => event.stopPropagation()}>
            <p className={styles.kicker}>{picked.category}</p>
            <h2 id="search-article-title">{picked.articleName}</h2>
            <p className={styles.meta}>By {picked.authorName || 'Unknown'}</p>
            <p>{plainText(picked.description)}</p>
            <button className={styles.btn} type="button" onClick={() => setPicked(undefined)}>Close</button>
          </div>
        </div>
      )}
      {open === 'profile' && (
        <div className={styles.panel} role="dialog" aria-label="Profile">
          <button ref={closeRef} className={styles.textBtn} type="button" onClick={() => setOpen('')}>Close</button>
          <p><strong>{portal.userDisplayName}</strong></p>
          <p>{portal.userEmail}</p>
        </div>
      )}
      {open === 'ticket' && (
        <div className={styles.backdrop} onClick={() => setOpen('')}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="ticket-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="ticket-title">Raise a ticket</h2>
            <p>A laptop replacement follows IT Asset Policy v2.3: raise it in ServiceNow under Hardware Replacement. Approval from the reporting manager is required.</p>
            <form onSubmit={submitTicket}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ticket-topic">Topic</label>
                <select id="ticket-topic" className={styles.select} value={ticketTopic} onChange={(event) => setTicketTopic(event.target.value)}>
                  <option>Hardware replacement</option>
                  <option>Leave</option>
                  <option>Access</option>
                  <option>Other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ticket-details">Details</label>
                <textarea id="ticket-details" className={styles.textarea} value={ticketDetails} onChange={(event) => setTicketDetails(event.target.value)} required />
              </div>
              {ticketNote && <p role="status">{ticketNote}</p>}
              <div className={styles.toolbar}>
                <button className={styles.btn} type="submit">Submit ticket</button>
                <button ref={closeRef} className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={() => setOpen('')}>Close</button>
              </div>
            </form>
            <p>
              <a href="#knowledge" onClick={(event) => openView(event, 'knowledge', '', 'IT Asset Management Policy')}>Open IT Asset Management Policy</a>
            </p>
            {tickets.length > 0 && (
              <ul>
                {tickets.slice(0, 5).map((item) => (
                  <li key={item.id}>{item.topic}: {item.details} · {item.status}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {open === 'ask' && (
        <div className={styles.backdrop} onClick={() => setOpen('')}>
          <div className={`${styles.dialog} ${styles.askDialog}`} role="dialog" aria-modal="true" aria-label="Knowledge assistant" onClick={(event) => event.stopPropagation()}>
            <React.Suspense fallback={<p>Loading the assistant.</p>}>
              <AssistantPanel portal={portal} />
            </React.Suspense>
            <button className={styles.btn} type="button" onClick={() => setOpen('')}>Close</button>
          </div>
        </div>
      )}
      <main id="main-content">
        {props.children}
      </main>
      <button className={styles.askBtn} type="button" onClick={() => setOpen(open === 'ask' ? '' : 'ask')}>Ask</button>
      <footer className={styles.footer}>Knowledge Management Portal · Capgemini</footer>
    </div>
  );
};

export function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem('kmp-saved');
    return raw ? JSON.parse(raw) as string[] : [];
  } catch {
    return [];
  }
}

export function toggleSaved(name: string): string[] {
  const saved = readSaved();
  const next = saved.indexOf(name) >= 0 ? saved.filter((item) => item !== name) : saved.concat([name]);
  window.localStorage.setItem('kmp-saved', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('kmp-saved-changed', { detail: { names: next } }));
  return next;
}
