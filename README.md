# Knowledge Management Portal

SharePoint Framework solution for [KnowledgeManagementPortal](https://holidaywiser.sharepoint.com/sites/KnowledgeManagementPortal).

Power Apps and Power Automate are not included. Teams cards are posted with Microsoft Graph, and the assistant answers only from SharePoint articles.

The architecture diagram is [docs/architecture.png](docs/architecture.png).

## Web parts

| Web part | Role |
| --- | --- |
| Dashboard Repository | Home page, 10 sample articles, KPIs, charts, and the live access log |
| Knowledge Repository | Filter, sort, open, save, and request approval for an article |
| Knowledge Assistant | Retrieval over approved articles, with a source link and confidence score |

The menu includes **Knowledge repository** and **Dashboard**. **Ask** opens the same assistant on the home and repository pages. Each web part is its own bundle, and the assistant code loads when Ask is opened.

Opening an article writes the person, category, and date/time to `ArticleAccessLog`. The dashboard reads that list and refreshes about every 20 seconds.

## Setup

```bash
npm install
gulp serve
gulp bundle --ship
gulp package-solution --ship
```

The package is `sharepoint/solution/knowledge-portal.sppkg`. Deploy it to the tenant app catalog, trust it, and add the web parts on the site.

In the web part property pane set:

- Site URL: `https://holidaywiser.sharepoint.com/sites/KnowledgeManagementPortal`
- Teams team id and channel id, if announcements and approval cards should be posted

After upload, a tenant admin approves **ChannelMessage.Send** for Microsoft Graph under API access. The signed-in user must be allowed to post in that channel.

## Accessibility checklist (WCAG 2.1 AA)

| Check | How it is met |
| --- | --- |
| 1.1.1 Non-text content | The logo has a text alternative. Decorative photos use an empty alt. Icon buttons have accessible names. |
| 1.3.1 Info and relationships | One page heading, labelled fields, and tables with captions. |
| 1.4.3 Contrast | Navy `#16315f` on white, muted text `#5c6b7c` on white, and white on `#1f4e9d` meet 4.5:1. |
| 1.4.10 Reflow | Header, filters, and cards stack below 900px. |
| 1.4.11 Non-text contrast | Field borders and the 3px focus outline are visible. |
| 2.1.1 Keyboard | Search, menus, filters, dialogs, and the assistant can be used without a pointer. |
| 2.4.1 Bypass blocks | Skip to content is the first control. |
| 2.4.3 Focus order | Opening a dialog moves focus to its close control. |
| 2.4.7 Focus visible | `:focus-visible` draws a 3px outline. |
| 4.1.2 Name, role, value | Dialogs use `role="dialog"`. The bell count is in the button name. Search results use a live region. |

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Articles stay at zero | Open Dashboard Repository while signed in as someone who can add list items, then use **Upload 10 sample articles**. |
| Create list or create item fails | Confirm the web part site URL is the Knowledge Management Portal site, then refresh. The lists `KnowledgeArticles` and `ArticleAccessLog` should already exist. |
| Teams card is not posted | Fill in the team id and channel id. Ask an admin to approve ChannelMessage.Send. Confirm the user can post in that channel. |
| Assistant says nothing matches | The question has to overlap an approved or published article. Draft articles are ignored. |
| Bell count looks high | The count is articles you have not opened from the bell. Open each one and the count drops. |
| Workbench menu opens a missing page | On the local workbench, Home and Dashboard stay on the workbench. Add the web part from **Knowledge Management Portal**. |

## Design decisions

The home page, repository, and dashboard are React function components. SharePoint data uses REST through `SPHttpClient`, so the calls run as the current user and list permissions apply to the assistant as well. The assistant does not call the public internet. It scores the question against approved article text and returns that text, the source, the section, the last updated date, and a confidence percentage.

Teams receives adaptive cards for a new-article announcement and for an approval request. Those cards link back to the article. Approval routing, email, and Power Automate logging are outside this delivery.

## Challenges

SharePoint rejects verbose list payloads when the SPFx client sends OData 4. Item and list writes use `odata=nometadata` without a metadata wrapper. The person column cannot be named Author, because SharePoint reserves that name, so the byline is stored in `AuthorName`.

## Mentoring notes

Start from the list the page reads, then the web part that writes it, then the screen that shows it. When a SharePoint call fails, read the status code before changing the layout. Keep sample articles named differently so filter and sort can be demonstrated. Do not add a flow or an external search call until the article text on the site already answers the question.
