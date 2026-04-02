import * as cheerio from 'cheerio';
import type { ParseResult, ParsedBlock } from '@/lib/types';

export function parseHTML(html: string): ParseResult {
  const $ = cheerio.load(html);

  // 1. Extract all <head> link tags (fonts, preconnects, stylesheets)
  const headLinks: string[] = [];
  $('link[rel="preconnect"], link[rel="stylesheet"], link[href*="fonts"]').each((_, el) => {
    headLinks.push($.html(el)!);
  });
  $('link[rel="preconnect"], link[rel="stylesheet"], link[href*="fonts"]').remove();

  // Extract all <style> tags (head and body)
  const styleParts: string[] = [];
  $('style').each((_, el) => {
    const content = $(el).html();
    if (content?.trim()) {
      styleParts.push(content);
    }
  });
  $('style').remove();

  // Store head links and CSS together with a reliable separator
  const cssContent = styleParts.join('\n\n');
  const stylesheet = headLinks.length > 0
    ? `<!--HEAD_LINKS-->\n${headLinks.join('\n')}\n<!--/HEAD_LINKS-->\n${cssContent}`
    : cssContent;

  // 2. Extract scripts
  const scriptParts: string[] = [];
  $('script').each((_, el) => {
    const content = $(el).html();
    if (content?.trim()) {
      scriptParts.push(content);
    }
  });
  $('script').remove();
  const scripts = scriptParts.join('\n\n');

  // 3. Extract title
  const titleTag = $('title').text().trim();
  const firstH1 = $('h1').first().text().trim();
  const title = titleTag || firstH1 || 'Untitled Proposal';

  // 4. Split body into blocks
  const blocks: ParsedBlock[] = [];
  let order = 0;

  const bodyChildren = $('body').children().toArray();

  for (const child of bodyChildren) {
    if (child.type !== 'tag') continue;
    const el = $(child);
    const tagName = child.tagName.toLowerCase();

    // Check if this is a wrapper div that should be expanded
    const wrapperClass = getWrapperClass(el, tagName);
    if (wrapperClass) {
      const wrapperChildren = el.children().toArray();
      for (const wChild of wrapperChildren) {
        if (wChild.type !== 'tag') continue;
        const wEl = $(wChild);

        // Keep empty visual dividers (e.g., <div class="rule">)
        if (isEmptyElement(wEl) && !isVisualDivider(wEl)) continue;

        blocks.push({
          order: order++,
          label: autoLabel(wEl, wChild.tagName.toLowerCase(), order, $),
          html: $.html(wChild)!,
          wrapperClass,
        });
      }
    } else {
      if (isEmptyElement(el) && !isVisualDivider(el)) continue;

      blocks.push({
        order: order++,
        label: autoLabel(el, tagName, order, $),
        html: $.html(child)!,
      });
    }
  }

  return { title, stylesheet, scripts, blocks };
}

/** Check if element has no meaningful content */
function isEmptyElement(el: cheerio.Cheerio<any>): boolean {
  return !el.html()?.trim() && !el.text()?.trim();
}

/** Check if an empty element is a visual divider that should be preserved */
function isVisualDivider(el: cheerio.Cheerio<any>): boolean {
  const className = el.attr('class') || '';
  const tagName = (el.get(0) as any)?.tagName?.toLowerCase() || '';
  return (
    tagName === 'hr' ||
    /\brule\b/i.test(className) ||
    /\bdivider\b/i.test(className) ||
    /\bseparator\b/i.test(className) ||
    /\bspacer\b/i.test(className)
  );
}

/**
 * Returns the wrapper's CSS class if this is a wrapper div that should be
 * expanded into its children. Returns null if it's a regular block.
 */
function getWrapperClass(
  el: cheerio.Cheerio<any>,
  tagName: string,
): string | null {
  if (tagName !== 'div') return null;

  const className = el.attr('class') || '';
  const id = el.attr('id') || '';

  const wrapperPatterns = [
    /wrap/i, /wrapper/i, /container/i, /content/i, /main-content/i,
    /page-content/i, /inner/i,
  ];

  const matches = wrapperPatterns.some(
    (p) => p.test(className) || p.test(id)
  );

  if (matches) {
    return className || id || 'wrapper';
  }

  // Also detect by structure: multiple semantic children
  const children = el.children().toArray();
  const sectionChildren = children.filter((c) => {
    if (c.type !== 'tag') return false;
    return ['section', 'article', 'header', 'footer', 'nav'].includes(
      c.tagName.toLowerCase()
    );
  });
  if (sectionChildren.length >= 2) {
    return className || 'wrapper';
  }

  return null;
}

function autoLabel(
  el: cheerio.Cheerio<any>,
  tagName: string,
  order: number,
  $: cheerio.CheerioAPI,
): string {
  const id = el.attr('id');
  if (id) return humanize(id);

  const heading = el.find('h1, h2, h3').first();
  if (heading.length) {
    const text = heading.text().trim();
    if (text && text.length < 80) return text;
  }

  const className = el.attr('class') || '';
  if (className) {
    if (/hero/i.test(className)) return 'Hero';
    if (/header|site-header/i.test(className)) return 'Header';
    if (/footer|site-footer/i.test(className)) return 'Footer';
    if (/\brule\b/i.test(className)) return 'Divider';
    if (/divider-label/i.test(className)) return el.text().trim() || 'Label';

    const classes = className.split(/\s+/);
    const meaningful = classes.find(
      (c) => !['section', 'block', 'container', 'wrap', 'inner'].includes(c)
    );
    if (meaningful) return humanize(meaningful);
  }

  const tagLabels: Record<string, string> = {
    header: 'Header', footer: 'Footer', nav: 'Navigation',
    main: 'Main Content', article: 'Article', aside: 'Sidebar', svg: 'Graphic',
  };
  if (tagLabels[tagName]) return tagLabels[tagName];

  if (tagName === 'div') {
    const text = el.text().trim();
    if (!text || text.length < 3) return 'Divider';
    if (el.find('table').length) return 'Table';
    if (el.find('img').length && !el.find('p').length) return 'Image';
  }

  const sectionLabel = el.find('.section-label').first();
  if (sectionLabel.length) return sectionLabel.text().trim();

  return `Block ${order}`;
}

function humanize(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
