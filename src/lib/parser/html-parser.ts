import * as cheerio from 'cheerio';
import type { ParseResult, ParsedBlock } from '@/lib/types';

/**
 * Parse a full HTML document into structured blocks for Proposal Studio.
 *
 * Algorithm:
 * 1. Extract all <style> content (including from <body>)
 * 2. Extract all <script> content
 * 3. Extract <link rel="stylesheet"> as @import statements
 * 4. Extract title from <title> or first <h1>
 * 5. Split <body> direct children into blocks
 *    - If a wrapper div has no semantic meaning (e.g. content-wrap),
 *      split its children instead
 * 6. Auto-label each block
 */
export function parseHTML(html: string): ParseResult {
  const $ = cheerio.load(html);

  // 1. Extract stylesheets
  const styleParts: string[] = [];

  // Extract <link rel="stylesheet"> as @import
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      styleParts.push(`@import url('${href}');`);
    }
  });
  $('link[rel="stylesheet"]').remove();

  // Extract <link rel="preconnect"> — preserve for font loading
  const preconnects: string[] = [];
  $('link[rel="preconnect"]').each((_, el) => {
    preconnects.push($.html(el)!);
  });
  $('link[rel="preconnect"]').remove();

  // Extract all <style> tags (head and body)
  $('style').each((_, el) => {
    const content = $(el).html();
    if (content?.trim()) {
      styleParts.push(content);
    }
  });
  $('style').remove();

  const stylesheet = styleParts.join('\n\n');

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
    const el = $(child);
    const tagName = child.type === 'tag' ? child.tagName.toLowerCase() : '';

    // Skip non-element nodes and empty whitespace
    if (child.type !== 'tag') continue;
    if (!el.html()?.trim() && !el.text()?.trim()) continue;

    // Check if this is a wrapper div that should be expanded
    if (isWrapperDiv(el, tagName)) {
      // Split wrapper's children into separate blocks
      const wrapperChildren = el.children().toArray();
      for (const wChild of wrapperChildren) {
        if (wChild.type !== 'tag') continue;
        const wEl = $(wChild);
        if (!wEl.html()?.trim() && !wEl.text()?.trim()) continue;

        blocks.push({
          order: order++,
          label: autoLabel(wEl, wChild.tagName.toLowerCase(), order, $),
          html: $.html(wChild)!,
        });
      }
    } else {
      // Regular top-level element becomes a block
      blocks.push({
        order: order++,
        label: autoLabel(el, tagName, order, $),
        html: $.html(child)!,
      });
    }
  }

  // Prepend preconnect links to stylesheet for font loading
  const fullStylesheet = preconnects.length > 0
    ? `<!-- Font preconnects -->\n${preconnects.join('\n')}\n\n${stylesheet}`
    : stylesheet;

  return { title, stylesheet: fullStylesheet, scripts, blocks };
}

/**
 * Detect wrapper divs that should be expanded into their children.
 * A wrapper div is a generic <div> whose sole purpose is layout grouping.
 */
function isWrapperDiv(
  el: cheerio.Cheerio<any>,
  tagName: string,
): boolean {
  if (tagName !== 'div') return false;

  const className = el.attr('class') || '';
  const id = el.attr('id') || '';

  // Common wrapper patterns
  const wrapperPatterns = [
    /wrap/i, /wrapper/i, /container/i, /content/i, /main-content/i,
    /page-content/i, /inner/i,
  ];

  const isWrapper = wrapperPatterns.some(
    (p) => p.test(className) || p.test(id)
  );

  // Also check: if the div has multiple section/div children with semantic content,
  // it's likely a wrapper
  if (!isWrapper) {
    const children = el.children().toArray();
    const sectionChildren = children.filter((c) => {
      if (c.type !== 'tag') return false;
      return ['section', 'article', 'header', 'footer', 'nav'].includes(
        c.tagName.toLowerCase()
      );
    });
    // If most children are semantic elements, treat as wrapper
    return sectionChildren.length >= 2;
  }

  return isWrapper;
}

/**
 * Auto-detect a label for a block element.
 * Priority: id → first heading text → class name → tag name → "Block N"
 */
function autoLabel(
  el: cheerio.Cheerio<any>,
  tagName: string,
  order: number,
  $: cheerio.CheerioAPI,
): string {
  // Check id attribute
  const id = el.attr('id');
  if (id) {
    return humanize(id);
  }

  // Check for first heading
  const heading = el.find('h1, h2, h3').first();
  if (heading.length) {
    const text = heading.text().trim();
    if (text && text.length < 80) {
      return text;
    }
  }

  // Check class names for semantic meaning
  const className = el.attr('class') || '';
  if (className) {
    // Specific patterns
    if (/hero/i.test(className)) return 'Hero';
    if (/header|site-header/i.test(className)) return 'Header';
    if (/footer|site-footer/i.test(className)) return 'Footer';
    if (/rule|divider|separator|hr/i.test(className)) return 'Divider';
    if (/divider-label/i.test(className)) {
      const text = el.text().trim();
      return text || 'Label';
    }

    // General: humanize first meaningful class
    const classes = className.split(/\s+/);
    const meaningful = classes.find(
      (c) => !['section', 'block', 'container', 'wrap', 'inner'].includes(c)
    );
    if (meaningful) {
      return humanize(meaningful);
    }
  }

  // Check tag name
  const tagLabels: Record<string, string> = {
    header: 'Header',
    footer: 'Footer',
    nav: 'Navigation',
    main: 'Main Content',
    article: 'Article',
    aside: 'Sidebar',
    svg: 'Graphic',
  };
  if (tagLabels[tagName]) return tagLabels[tagName];

  // Check for specific content patterns
  if (tagName === 'div') {
    const text = el.text().trim();
    if (!text || text.length < 3) return 'Divider';
    if (el.find('table').length) return 'Table';
    if (el.find('img').length && !el.find('p').length) return 'Image';
  }

  // Check section-label or section-title inside
  const sectionLabel = el.find('.section-label').first();
  if (sectionLabel.length) {
    return sectionLabel.text().trim();
  }

  return `Block ${order}`;
}

/**
 * Convert kebab/snake/camelCase to human-readable title case.
 */
function humanize(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
