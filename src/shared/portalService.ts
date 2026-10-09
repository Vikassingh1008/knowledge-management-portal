import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import {
  IAccessLog,
  IArticle,
  IArticleInput,
  LISTS
} from './models';
import { SAMPLE_ARTICLES } from './sampleData';
import { dateInputValue, lineValue } from './format';

interface IFieldRow {
  Title: string;
  InternalName: string;
  FieldTypeKind?: number;
}

let seedTask: Promise<string[]> | undefined;

const LOCAL_LOG = 'kmp-access-log';

function odata(value: string): string {
  return value.replace(/'/g, "''");
}

function asArray<T>(payload: { value?: T[]; d?: { results?: T[] } }): T[] {
  if (payload.value) {
    return payload.value;
  }
  if (payload.d && payload.d.results) {
    return payload.d.results;
  }
  return [];
}

export function readLocalLogs(): IAccessLog[] {
  try {
    const raw = window.sessionStorage.getItem(LOCAL_LOG);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as IAccessLog[];
  } catch {
    return [];
  }
}

export function pushLocalLog(article: IArticle, userName: string): void {
  const logs = readLocalLogs();
  logs.unshift({
    id: new Date().getTime(),
    title: article.articleName,
    articleId: article.id,
    articleName: article.articleName,
    userName: userName,
    accessDateTime: new Date().toISOString(),
    category: article.category
  });
  window.sessionStorage.setItem(LOCAL_LOG, JSON.stringify(logs.slice(0, 200)));
}

export class PortalService {
  public constructor(private spHttpClient: SPHttpClient, private siteUrl: string) {}

  public async getArticles(): Promise<IArticle[]> {
    const fields = await this.fieldsOf(LISTS.articles);
    const author = this.personInternal(fields, 'Author');
    const select = ['Id', 'Title'];
    const wanted = ['ArticleName', 'Description', 'Category', 'AuthorName', 'Status', 'Published', 'ViewCount', 'StartDate', 'EndDate', 'ArticleURL', 'Modified'];
    for (let i = 0; i < wanted.length; i++) {
      if (this.findField(fields, wanted[i])) {
        select.push(wanted[i]);
      }
    }
    let expand = '';
    if (author) {
      select.push(author + '/Title');
      expand = '&$expand=' + author;
    }
    const url = this.listUrl(LISTS.articles) + "/items?$select=" + select.join(',') + expand + "&$top=200&$orderby=Modified desc";
    const payload = await this.getJson<{ value: IRestArticle[] }>(url);
    return asArray<IRestArticle>(payload).map((row) => this.mapArticle(row, author));
  }

  public async getAccessLogs(): Promise<IAccessLog[]> {
    const fields = await this.fieldsOf(LISTS.access);
    const userField = this.personInternal(fields, 'User');
    const select = ['Id', 'Title'];
    const wanted = ['ArticleId', 'ArticleName', 'AccessUserName', 'AccessDateTime', 'Category'];
    for (let i = 0; i < wanted.length; i++) {
      if (this.findField(fields, wanted[i])) {
        select.push(wanted[i]);
      }
    }
    let expand = '';
    if (userField) {
      select.push(userField + '/Title');
      expand = '&$expand=' + userField;
    }
    const order = this.findField(fields, 'AccessDateTime') ? '&$orderby=AccessDateTime desc' : '&$orderby=Id desc';
    const url = this.listUrl(LISTS.access) + "/items?$select=" + select.join(',') + expand + "&$top=200" + order;
    const payload = await this.getJson<{ value: IRestAccess[] }>(url);
    return asArray<IRestAccess>(payload).map((row) => {
      const person = userField ? row[userField] as { Title?: string } | undefined : undefined;
      return {
        id: row.Id,
        title: row.Title || '',
        articleId: row.ArticleId || 0,
        articleName: row.ArticleName || row.Title || '',
        userName: row.AccessUserName || (person && person.Title) || '',
        accessDateTime: row.AccessDateTime || '',
        category: row.Category || ''
      };
    });
  }

  public async logAccess(article: IArticle, userName: string): Promise<void> {
    const articleFields = await this.fieldsOf(LISTS.articles);
    if (this.findField(articleFields, 'ViewCount')) {
      await this.mergeItem(LISTS.articles, article.id, { ViewCount: (article.viewCount || 0) + 1 });
    }
    const fields = await this.fieldsOf(LISTS.access);
    const body: { [key: string]: string | number | boolean | IUrlValue } = {
      Title: article.articleName
    };
    if (this.findField(fields, 'ArticleId')) {
      body.ArticleId = article.id;
    }
    if (this.findField(fields, 'ArticleName')) {
      body.ArticleName = article.articleName;
    }
    if (this.findField(fields, 'AccessUserName')) {
      body.AccessUserName = userName;
    }
    if (this.findField(fields, 'AccessDateTime')) {
      body.AccessDateTime = new Date().toISOString();
    }
    if (this.findField(fields, 'Category')) {
      body.Category = article.category;
    }
    const userField = this.personInternal(fields, 'User');
    if (userField) {
      const userId = await this.currentUserId();
      if (userId) {
        body[userField + 'Id'] = userId;
      }
    }
    await this.createItem(LISTS.access, body);
  }

  public async saveArticle(input: IArticleInput, existingId: number, userId: number): Promise<number> {
    const fields = await this.fieldsOf(LISTS.articles);
    const author = this.personInternal(fields, 'Author');
    const body: { [key: string]: string | number | boolean | IUrlValue } = {
      Title: input.articleName
    };
    this.putField(fields, body, 'ArticleName', input.articleName);
    this.putField(fields, body, 'Description', input.description);
    this.putField(fields, body, 'Category', input.category);
    this.putField(fields, body, 'AuthorName', input.authorName || '');
    this.putField(fields, body, 'Status', input.status);
    this.putField(fields, body, 'Published', input.published);
    if (input.startDate) {
      this.putField(fields, body, 'StartDate', input.startDate);
    }
    if (input.endDate) {
      this.putField(fields, body, 'EndDate', input.endDate);
    }
    if (input.articleUrl && this.findField(fields, 'ArticleURL')) {
      body.ArticleURL = {
        __metadata: { type: 'SP.FieldUrlValue' },
        Url: input.articleUrl,
        Description: input.articleName
      };
    }
    if (!existingId && userId && author) {
      body[author + 'Id'] = userId;
    }
    if (existingId) {
      await this.mergeItem(LISTS.articles, existingId, body);
      return existingId;
    }
    const created = await this.createItem(LISTS.articles, body);
    return created;
  }

  public async updateStatus(articleId: number, status: string, published?: boolean): Promise<void> {
    const fields = await this.fieldsOf(LISTS.articles);
    const body: { [key: string]: string | number | boolean | IUrlValue } = {};
    this.putField(fields, body, 'Status', status);
    if (published !== undefined) {
      this.putField(fields, body, 'Published', published);
    }
    await this.mergeItem(LISTS.articles, articleId, body);
  }

  public async currentUserId(): Promise<number> {
    const payload = await this.getJson<{ Id: number }>(this.siteUrl + '/_api/web/currentuser?$select=Id,Email,Title');
    return payload.Id || 0;
  }

  public provision(): Promise<string[]> {
    if (seedTask) {
      return seedTask;
    }
    seedTask = this.seedLists().then((notes) => {
      seedTask = undefined;
      return notes;
    }, (error: Error) => {
      seedTask = undefined;
      throw error;
    });
    return seedTask;
  }

  private async seedLists(): Promise<string[]> {
    const notes: string[] = [];
    await this.ensureList(LISTS.articles, 'Knowledge articles for the portal.');
    await this.ensureList(LISTS.access, 'Real-time article access log. No choice column.');
    notes.push('KnowledgeArticles and ArticleAccessLog are ready.');

    const articleNotes = await this.ensureFields(LISTS.articles, [
      { title: 'ArticleName', kind: 2, required: true },
      { title: 'Description', kind: 3 },
      { title: 'Category', kind: 6, choices: ['IT', 'HR', 'Security', 'Finance', 'Operations'] },
      { title: 'Author', kind: 20 },
      { title: 'AuthorName', kind: 2 },
      { title: 'StartDate', kind: 4 },
      { title: 'EndDate', kind: 4 },
      { title: 'Status', kind: 6, choices: ['Draft', 'Pending Approval', 'Approved', 'Published', 'Expired', 'Rejected'] },
      { title: 'AssignedUsers', kind: 20, multi: true },
      { title: 'Published', kind: 8, defaultValue: '0' },
      { title: 'ArticleURL', kind: 11 },
      { title: 'ViewCount', kind: 9, defaultValue: '0' }
    ]);
    for (let n = 0; n < articleNotes.length; n++) {
      notes.push(articleNotes[n]);
    }
    const accessNotes = await this.ensureFields(LISTS.access, [
      { title: 'ArticleId', kind: 9 },
      { title: 'ArticleName', kind: 2 },
      { title: 'User', kind: 20 },
      { title: 'AccessUserName', kind: 2 },
      { title: 'AccessDateTime', kind: 4 },
      { title: 'Category', kind: 2 }
    ]);
    for (let n = 0; n < accessNotes.length; n++) {
      notes.push(accessNotes[n]);
    }

    const articles = await this.getArticles().catch(() => [] as IArticle[]);
    const names: string[] = [];
    for (let i = 0; i < articles.length; i++) {
      names.push(articles[i].articleName);
    }
    const userId = await this.currentUserId().catch(() => 0);
    let added = 0;
    for (let i = 0; i < SAMPLE_ARTICLES.length; i++) {
      const sample = SAMPLE_ARTICLES[i];
      if (names.indexOf(sample.articleName) >= 0) {
        continue;
      }
      const input: IArticleInput = {
        articleName: sample.articleName,
        description: sample.description,
        category: sample.category,
        authorName: sample.authorName,
        startDate: sample.startDate,
        endDate: sample.endDate,
        status: 'Published',
        published: true,
        articleUrl: this.siteUrl + '/SitePages/Knowledge-Repository.aspx?article=' + encodeURIComponent(sample.articleName)
      };
      try {
        await this.saveArticle(input, 0, userId);
        added++;
      } catch (error) {
        try {
          await this.createItem(LISTS.articles, { Title: sample.articleName });
          added++;
        } catch (fallback) {
          const first = error instanceof Error ? error.message : 'Create failed';
          const second = fallback instanceof Error ? fallback.message : '';
          throw new Error('Could not add "' + sample.articleName + '" to KnowledgeArticles. ' + (second || first).substring(0, 280));
        }
      }
    }
    notes.push(added ? 'Added ' + added + ' articles to KnowledgeArticles.' : 'KnowledgeArticles already has the 10 articles.');
    return notes;
  }

  private mapArticle(row: IRestArticle, authorField: string): IArticle {
    const author = row[authorField] as { Title?: string } | undefined;
    const link = row.ArticleURL;
    const description = row.Description || '';
    return {
      id: row.Id,
      title: row.Title || row.ArticleName || '',
      articleName: row.ArticleName || row.Title || '',
      description: description,
      category: choiceText(row.Category),
      authorName: row.AuthorName || (author && author.Title) || '',
      startDate: dateInputValue(row.StartDate || ''),
      endDate: dateInputValue(row.EndDate || ''),
      status: choiceText(row.Status) || 'Draft',
      published: row.Published === true || row.Published === 1 || row.Published === '1' || row.Published === 'true' || choiceText(row.Status).toLowerCase() === 'published' || choiceText(row.Status).toLowerCase() === 'approved',
      articleUrl: link && link.Url ? link.Url : '',
      viewCount: row.ViewCount || 0,
      section: lineValue(description, 'Section'),
      lastUpdated: lineValue(description, 'Last updated'),
      modified: row.Modified || ''
    };
  }

  private async fieldsOf(list: string): Promise<IFieldRow[]> {
    const payload = await this.getJson<{ value: IFieldRow[] }>(this.listUrl(list) + "/fields?$select=Title,InternalName,FieldTypeKind");
    return asArray<IFieldRow>(payload);
  }

  private findField(fields: IFieldRow[], title: string): IFieldRow | undefined {
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].Title === title || fields[i].InternalName === title) {
        return fields[i];
      }
    }
    return undefined;
  }

  private personInternal(fields: IFieldRow[], title: string): string {
    for (let i = 0; i < fields.length; i++) {
      const kind = fields[i].FieldTypeKind;
      if (fields[i].Title === title && fields[i].InternalName !== 'Author' && (!kind || kind === 20)) {
        return fields[i].InternalName;
      }
    }
    const fallback = title === 'Author' ? 'ArticleAuthor' : '';
    if (!fallback) {
      return '';
    }
    const field = this.findField(fields, fallback);
    return field ? field.InternalName : '';
  }

  private async ensureList(title: string, description: string): Promise<void> {
    if (await this.listExists(title)) {
      return;
    }
    const response = await this.spHttpClient.post(this.siteUrl + '/_api/web/lists', SPHttpClient.configurations.v1, {
      headers: this.itemHeaders(),
      body: JSON.stringify({
        Title: title,
        BaseTemplate: 100,
        Description: description
      })
    });
    if (response.ok || await this.listExists(title)) {
      await response.text();
      return;
    }
    const text = await response.text();
    if (text.toLowerCase().indexOf('already exists') >= 0) {
      return;
    }
    throw new Error('Create list ' + title + ' failed (' + response.status + ').');
  }

  private async listExists(title: string): Promise<boolean> {
    const direct = await this.spHttpClient.get(
      this.listUrl(title) + '?$select=Id,Title',
      SPHttpClient.configurations.v1,
      { headers: this.itemHeaders() }
    );
    const directText = await direct.text();
    if (direct.ok) {
      return true;
    }
    if (directText.toLowerCase().indexOf('does not exist') < 0 && direct.status !== 404) {
      const listed = await this.spHttpClient.get(
        this.siteUrl + "/_api/web/lists?$select=Title,Id&$filter=Title eq '" + odata(title) + "'",
        SPHttpClient.configurations.v1,
        { headers: this.itemHeaders() }
      );
      const listedText = await listed.text();
      return listed.ok && listedText.indexOf(title) >= 0;
    }
    return false;
  }

  private putField(
    fields: IFieldRow[],
    body: { [key: string]: string | number | boolean | IUrlValue },
    title: string,
    value: string | number | boolean
  ): void {
    if (this.findField(fields, title)) {
      body[title] = value;
    }
  }

  private async ensureFields(list: string, specs: IFieldSpec[]): Promise<string[]> {
    const notes: string[] = [];
    const fields = await this.fieldsOf(list);
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (this.hasField(fields, spec.title)) {
        continue;
      }
      try {
        await this.addField(list, spec);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'column was not added';
        notes.push(spec.title + ' was left unchanged. ' + reason.substring(0, 160));
      }
    }
    return notes;
  }

  private hasField(fields: IFieldRow[], title: string): boolean {
    return !!this.findField(fields, title);
  }

  private async addField(list: string, spec: IFieldSpec): Promise<void> {
    const response = await this.spHttpClient.post(
      this.listUrl(list) + '/fields/createfieldasxml',
      SPHttpClient.configurations.v1,
      {
        headers: this.itemHeaders(),
        body: JSON.stringify({
          parameters: {
            SchemaXml: this.fieldXml(spec)
          }
        })
      }
    );
    if (!response.ok && spec.title === 'Author') {
      const fallback = await this.spHttpClient.post(
        this.listUrl(list) + '/fields/createfieldasxml',
        SPHttpClient.configurations.v1,
        {
          headers: this.itemHeaders(),
          body: JSON.stringify({
            parameters: {
              SchemaXml: '<Field Type="User" DisplayName="ArticleAuthor" Name="ArticleAuthor" />'
            }
          })
        }
      );
      await this.assertOk(fallback, 'Add field ArticleAuthor');
      return;
    }
    await this.assertOk(response, 'Add field ' + spec.title);
  }

  private fieldXml(spec: IFieldSpec): string {
    const name = spec.title === 'Author' ? 'ArticleAuthor' : spec.title;
    const display = name;
    if (spec.kind === 6 && spec.choices) {
      const choices = spec.choices.map((choice) => '<CHOICE>' + choice + '</CHOICE>').join('');
      return '<Field Type="Choice" DisplayName="' + display + '" Name="' + name + '"><CHOICES>' + choices + '</CHOICES></Field>';
    }
    if (spec.kind === 3) {
      return '<Field Type="Note" DisplayName="' + display + '" Name="' + name + '" NumLines="6" RichText="FALSE" />';
    }
    if (spec.kind === 20) {
      const type = spec.multi ? 'UserMulti' : 'User';
      return '<Field Type="' + type + '" DisplayName="' + display + '" Name="' + name + '" />';
    }
    if (spec.kind === 4) {
      return '<Field Type="DateTime" DisplayName="' + display + '" Name="' + name + '" Format="DateOnly" />';
    }
    if (spec.kind === 8) {
      return '<Field Type="Boolean" DisplayName="' + display + '" Name="' + name + '"><Default>0</Default></Field>';
    }
    if (spec.kind === 9) {
      return '<Field Type="Number" DisplayName="' + display + '" Name="' + name + '" />';
    }
    if (spec.kind === 11) {
      return '<Field Type="URL" DisplayName="' + display + '" Name="' + name + '" />';
    }
    const required = spec.required ? ' Required="TRUE"' : '';
    return '<Field Type="Text" DisplayName="' + display + '" Name="' + name + '"' + required + ' />';
  }

  private async createItem(list: string, fields: { [key: string]: string | number | boolean | IUrlValue }): Promise<number> {
    const response = await this.spHttpClient.post(this.listUrl(list) + '/items', SPHttpClient.configurations.v1, {
      headers: this.itemHeaders(),
      body: JSON.stringify(this.plainBody(fields))
    });
    await this.assertOk(response, 'Create item in ' + list);
    const text = await response.text();
    if (!text) {
      return 0;
    }
    const payload = JSON.parse(text) as { Id?: number; ID?: number };
    return payload.Id || payload.ID || 0;
  }

  private async mergeItem(list: string, id: number, fields: { [key: string]: string | number | boolean | IUrlValue }): Promise<void> {
    const response = await this.spHttpClient.post(this.listUrl(list) + '/items(' + id + ')', SPHttpClient.configurations.v1, {
      headers: this.itemHeaders({ 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' }),
      body: JSON.stringify(this.plainBody(fields))
    });
    await this.assertOk(response, 'Update item ' + id);
  }

  private itemHeaders(extra?: { [key: string]: string }): { [key: string]: string } {
    const headers: { [key: string]: string } = {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      'odata-version': ''
    };
    if (extra) {
      for (const key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) {
          headers[key] = extra[key];
        }
      }
    }
    return headers;
  }

  private plainBody(fields: { [key: string]: string | number | boolean | IUrlValue }): { [key: string]: string | number | boolean | { Url: string; Description: string } } {
    const body: { [key: string]: string | number | boolean | { Url: string; Description: string } } = {};
    for (const key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) {
        continue;
      }
      const value = fields[key];
      if (value && typeof value === 'object') {
        body[key] = { Url: value.Url, Description: value.Description };
      } else {
        body[key] = value;
      }
    }
    return body;
  }

  private listUrl(title: string): string {
    return this.siteUrl + "/_api/web/lists/getbytitle('" + odata(title) + "')";
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await this.spHttpClient.get(url, SPHttpClient.configurations.v1, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  private async assertOk(response: SPHttpClientResponse, action: string): Promise<void> {
    if (response.ok) {
      return;
    }
    await response.text();
    throw new Error(action + ' failed (' + response.status + ').');
  }
}

function choiceText(value: unknown): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const choice = value as { Value?: string };
    return choice.Value || '';
  }
  return '';
}

interface IFieldSpec {
  title: string;
  kind: number;
  required?: boolean;
  choices?: string[];
  defaultValue?: string;
  multi?: boolean;
}

interface IUrlValue {
  __metadata: { type: string };
  Url: string;
  Description: string;
}

interface IRestArticle {
  Id: number;
  Title?: string;
  ArticleName?: string;
  Description?: string;
  Category?: string;
  AuthorName?: string;
  Status?: string;
  Published?: boolean | number | string;
  ViewCount?: number;
  StartDate?: string;
  EndDate?: string;
  ArticleURL?: { Url?: string; Description?: string };
  Modified?: string;
  [key: string]: string | number | boolean | { Title?: string; EMail?: string } | { Url?: string; Description?: string } | undefined;
}

interface IRestAccess {
  Id: number;
  Title?: string;
  ArticleId?: number;
  ArticleName?: string;
  AccessUserName?: string;
  AccessDateTime?: string;
  Category?: string;
  [key: string]: string | number | { Title?: string } | undefined;
}
