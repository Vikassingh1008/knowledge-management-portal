const MONTHS: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function pageUrl(siteUrl: string, pageName: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return base + '/SitePages/' + pageName;
}

export function resolveSiteUrl(configured: string, currentWeb: string): string {
  const current = (currentWeb || '').replace(/\/$/, '');
  if (current.indexOf('KnowledgeManagementPortal') >= 0) {
    return current;
  }
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return current;
}

export function dateInputValue(value: string): string {
  if (!value) {
    return '';
  }
  return value.substring(0, 10);
}

export function formatLongDate(value: string): string {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return value;
  }
  return MONTHS_LONG[parsed.getMonth()] + ' ' + parsed.getDate() + ', ' + parsed.getFullYear();
}

export function formatShortDate(value: string): string {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.getDate() + ' ' + MONTHS[parsed.getMonth()] + ' ' + parsed.getFullYear();
}

export function formatDateTime(value: string): string {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return value;
  }
  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const minuteText = minutes < 10 ? '0' + minutes : String(minutes);
  return formatShortDate(value) + ' ' + hours + ':' + minuteText;
}

export function readQuery(name: string): string {
  const search = window.location.search;
  if (!search || search.length < 2) {
    return '';
  }
  const parts = search.substring(1).split('&');
  for (let i = 0; i < parts.length; i++) {
    const pair = parts[i].split('=');
    if (decodeURIComponent(pair[0] || '') === name) {
      return decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
    }
  }
  return '';
}

export function lineValue(description: string, label: string): string {
  const lines = (description || '').split('\n');
  const prefix = label + ':';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\s+|\s+$/g, '');
    if (line.indexOf(prefix) === 0) {
      return line.substring(prefix.length).replace(/^\s+|\s+$/g, '');
    }
  }
  return '';
}

export function plainText(description: string): string {
  const lines = (description || '').split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\s+|\s+$/g, '');
    if (!line) {
      continue;
    }
    if (line.indexOf('Section:') === 0 || line.indexOf('Last updated:') === 0) {
      continue;
    }
    kept.push(line);
  }
  return kept.join(' ');
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stretch(node: HTMLElement): void {
  node.style.setProperty('max-width', '100%', 'important');
  node.style.setProperty('width', '100%', 'important');
  node.style.setProperty('margin-left', '0', 'important');
  node.style.setProperty('margin-right', '0', 'important');
  node.style.setProperty('padding-left', '0', 'important');
  node.style.setProperty('padding-right', '0', 'important');
  node.style.setProperty('flex', '1 1 auto', 'important');
  node.style.setProperty('align-self', 'stretch', 'important');
  node.style.setProperty('box-sizing', 'border-box', 'important');
}

function applyFill(host: HTMLElement): void {
  host.style.padding = '0';
  host.style.margin = '0';
  host.style.display = 'block';
  host.style.minHeight = 'calc(100vh - 48px)';
  stretch(host);
  let node: HTMLElement | null = host.parentElement;
  let depth = 0;
  while (node && node !== document.body && depth < 30) {
    const id = node.id || '';
    const automation = node.getAttribute('data-automation-id') || '';
    if (id === 'SuiteNavWrapper' || id === 'spCommandBar' || automation.indexOf('CommandBar') >= 0) {
      break;
    }
    stretch(node);
    node = node.parentElement;
    depth++;
  }
  if (!document.getElementById('kmp-full-bleed')) {
    const style = document.createElement('style');
    style.id = 'kmp-full-bleed';
    style.textContent = [
      '#workbenchPageContent,',
      '#spPageCanvasContent,',
      '.SPCanvas,',
      '.SPCanvas-canvas,',
      '.CanvasZone,',
      '.CanvasSection,',
      '.ControlZone,',
      '.CanvasComponent,',
      '[data-automation-id="CanvasZone"],',
      '[data-automation-id="CanvasSection"],',
      '[data-automation-id="CanvasControl"],',
      '[data-automation-id="CanvasLayout"],',
      '[data-automation-id="contentScrollRegion"],',
      '[data-automation-id="pageCanvas"],',
      'div[class*="canvasWrapper"],',
      'div[class*="pageContainer"],',
      'div[class*="scrollRegion"] {',
      '  max-width: 100% !important;',
      '  width: 100% !important;',
      '  margin-left: 0 !important;',
      '  margin-right: 0 !important;',
      '  padding-left: 0 !important;',
      '  padding-right: 0 !important;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }
}

export function fillCanvas(host: HTMLElement): void {
  applyFill(host);
  if (host.getAttribute('data-kmp-fill') !== '1') {
    host.setAttribute('data-kmp-fill', '1');
    window.setTimeout(() => applyFill(host), 300);
    window.setTimeout(() => applyFill(host), 1200);
  }
}
