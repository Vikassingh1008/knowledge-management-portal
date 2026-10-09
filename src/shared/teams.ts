import { MSGraphClientFactory } from '@microsoft/sp-http';
import { IArticle, IPortalProps } from './models';

function cardShell(title: string, lines: string[], actionUrl: string, actionTitle: string): object {
  const body: object[] = [
    { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true }
  ];
  for (let i = 0; i < lines.length; i++) {
    body.push({ type: 'TextBlock', text: lines[i], wrap: true });
  }
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: body,
    actions: [
      { type: 'Action.OpenUrl', title: actionTitle, url: actionUrl }
    ]
  };
}

export function postChannelCard(factory: MSGraphClientFactory, teamId: string, channelId: string, card: object): Promise<void> {
  const team = (teamId || '').replace(/^\s+|\s+$/g, '');
  const channel = (channelId || '').replace(/^\s+|\s+$/g, '');
  if (!team || !channel) {
    return Promise.reject(new Error('Set the Teams team id and channel id in the web part properties.'));
  }
  return factory.getClient('3').then((client) => {
    return client.api('/teams/' + team + '/channels/' + channel + '/messages').post({
      body: {
        contentType: 'html',
        content: '<attachment id="card1"></attachment>'
      },
      attachments: [{
        id: 'card1',
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: JSON.stringify(card)
      }]
    });
  }).then(() => undefined);
}

export function announceNewArticles(portal: IPortalProps, articles: IArticle[]): Promise<string> {
  if (!portal.teamId || !portal.channelId) {
    return Promise.resolve('Teams announcement is waiting for a team id and channel id.');
  }
  const lines: string[] = [];
  const limit = Math.min(articles.length, 10);
  for (let i = 0; i < limit; i++) {
    lines.push((articles[i].category || 'Article') + ': ' + articles[i].articleName);
  }
  const card = cardShell(
    'New knowledge article announcement',
    lines,
    portal.siteUrl + '/SitePages/Knowledge-Repository.aspx',
    'Open the repository'
  );
  return postChannelCard(portal.msGraphClientFactory, portal.teamId, portal.channelId, card)
    .then(() => 'Announcement posted to Teams.')
    .catch((error: Error) => error.message || 'Teams announcement failed.');
}

export function requestApproval(portal: IPortalProps, article: IArticle): Promise<void> {
  const card = cardShell(
    'Approval request',
    [
      portal.userDisplayName + ' requested approval for ' + article.articleName + '.',
      'Category: ' + (article.category || 'Uncategorised') + '. Status: Pending Approval.'
    ],
    article.articleUrl || (portal.siteUrl + '/SitePages/Knowledge-Repository.aspx?article=' + encodeURIComponent(article.articleName)),
    'Open the article'
  );
  return postChannelCard(portal.msGraphClientFactory, portal.teamId, portal.channelId, card);
}
