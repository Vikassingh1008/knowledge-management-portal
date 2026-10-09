import * as React from 'react';
import styles from './portal.module.scss';
import { IArticle, IPortalProps } from './models';
import { pageUrl } from './format';
import { PortalService } from './portalService';
import { answerFromArticles } from './rag';

export interface IKnowledgeAssistantProps {
  portal: IPortalProps;
}

interface ITurn {
  role: 'user' | 'assistant';
  text: string;
  confidence: number;
  sourceTitle: string;
  section: string;
  lastUpdated: string;
  url: string;
}

export const KnowledgeAssistant: React.FC<IKnowledgeAssistantProps> = (props) => {
  const portal = props.portal;
  const [articles, setArticles] = React.useState<IArticle[]>([]);
  const [question, setQuestion] = React.useState('');
  const [note, setNote] = React.useState('Answers come only from approved articles you can read on this site.');
  const [turns, setTurns] = React.useState<ITurn[]>([{
    role: 'assistant',
    text: 'Ask a question about an approved knowledge article. I do not search the public internet.',
    confidence: 0,
    sourceTitle: '',
    section: '',
    lastUpdated: '',
    url: ''
  }]);

  React.useEffect(() => {
    const service = new PortalService(portal.spHttpClient, portal.siteUrl);
    service.getArticles().then((rows) => setArticles(rows)).catch(() => {
      setArticles([]);
      setNote('The knowledge articles could not be read with your current permissions.');
    });
  }, [portal.spHttpClient, portal.siteUrl]);

  const ask = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = question.replace(/^\s+|\s+$/g, '');
    if (!value) {
      return;
    }
    const result = answerFromArticles(value, articles);
    const sourceUrl = result.url || (result.sourceTitle
      ? pageUrl(portal.siteUrl, 'Knowledge-Repository.aspx') + '?article=' + encodeURIComponent(result.sourceTitle)
      : '');
    const next: ITurn[] = turns.concat([
      { role: 'user', text: value, confidence: 0, sourceTitle: '', section: '', lastUpdated: '', url: '' },
      {
        role: 'assistant',
        text: result.answer,
        confidence: result.confidence,
        sourceTitle: result.sourceTitle,
        section: result.section,
        lastUpdated: result.lastUpdated,
        url: sourceUrl
      }
    ]);
    setTurns(next);
    setQuestion('');
  };

  return (
    <section className={styles.assistant} aria-labelledby="assistant-title">
      <h2 id="assistant-title" className={styles.cardTitle}>Knowledge assistant</h2>
      <p className={styles.meta}>{note}</p>
      <div className={styles.chatLog} aria-live="polite">
        {turns.map((turn, index) => (
          <article key={turn.role + '-' + index} className={turn.role === 'user' ? styles.chatUser : styles.chatBot}>
            <p>{turn.text}</p>
            {turn.role === 'assistant' && turn.sourceTitle && (
              <p className={styles.meta}>
                Source: {turn.sourceTitle}
                {turn.section ? ' Section ' + turn.section : ''}
                {turn.lastUpdated ? ' Last Updated: ' + turn.lastUpdated : ''}
                {' · Confidence ' + turn.confidence + '%'}
                {turn.url && <span> · <a href={turn.url}>Open the source article</a></span>}
              </p>
            )}
          </article>
        ))}
      </div>
      <form className={styles.chatForm} onSubmit={ask}>
        <label className={styles.srOnly} htmlFor="assistant-question">Question</label>
        <input
          id="assistant-question"
          className={styles.input}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How do I request a laptop replacement?"
        />
        <button className={styles.btn} type="submit">Ask</button>
      </form>
    </section>
  );
};
