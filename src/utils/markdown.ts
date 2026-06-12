/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Very robust client-side HTML to Markdown parser for Word-processor style editors.
 */
/**
 * Very robust HTML sanitizer and element normalizer to scrub browser-specific cache,
 * layout metadata (cas properties), dynamic spellcheck/Grammarly nodes, and overlapping nested tags.
 */
export function cleanHTML(html: string): string {
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    // Remove any stylesheet, style, link, scripted, or metadata tags completely
    const unwanted = body.querySelectorAll('style, link, script, meta, iframe, xml, object, embed');
    unwanted.forEach(el => el.remove());

    // Recursively clean elements
    const allElements = body.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Clear dynamic spellcheck, Grammarly, and browser-specific caching attributes (cas, etc.)
      const attrs = Array.from(element.attributes);
      attrs.forEach(attr => {
        const name = attr.name.toLowerCase();
        if (
          name.startsWith('data-') ||
          name.startsWith('cas') ||
          name === 'class' ||
          name === 'id' ||
          name === 'spellcheck'
        ) {
          element.removeAttribute(attr.name);
        }
      });

      // Preserve only clean text alignment style rules
      const style = element.getAttribute('style') || '';
      if (style) {
        let alignStyle = '';
        if (style.includes('text-align: right') || style.includes('justifyRight')) {
          alignStyle = 'text-align: right;';
        } else if (style.includes('text-align: center') || style.includes('justifyCenter')) {
          alignStyle = 'text-align: center;';
        } else if (style.includes('text-align: left') || style.includes('justifyLeft')) {
          alignStyle = 'text-align: left;';
        }
        if (alignStyle) {
          element.setAttribute('style', alignStyle);
        } else {
          element.removeAttribute('style');
        }
      }

      // Standardize equivalent rich-text tags
      if (tagName === 'b') {
        const strong = doc.createElement('strong');
        strong.innerHTML = element.innerHTML;
        element.replaceWith(strong);
      } else if (tagName === 'strike' || tagName === 'del') {
        const s = doc.createElement('s');
        s.innerHTML = element.innerHTML;
        element.replaceWith(s);
      }
    });

    // Clean redundant nested formatting tags to prevent infinite nesting expansion
    let dirty = true;
    let limit = 0;
    while (dirty && limit < 5) {
      dirty = false;
      limit++;
      body.querySelectorAll('strong strong, s s, em em, u u').forEach(el => {
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (parent && parent.tagName.toLowerCase() === tag) {
          el.replaceWith(...Array.from(el.childNodes));
          dirty = true;
        }
      });
    }

    return body.innerHTML;
  } catch (error) {
    // Regex fallback
    return html
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/class="[^"]*"/gi, '')
      .replace(/id="[^"]*"/gi, '')
      .replace(/cas-[a-z0-0-]+="[^"]*"/gi, '')
      .replace(/data-[a-z0-0-]+="[^"]*"/gi, '');
  }
}

/**
 * Very robust client-side HTML to Markdown parser for Word-processor style editors.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  const cleanedHtml = cleanHTML(html);

  try {
    // Parse HTML string into a DOM tree
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedHtml, 'text/html');
    const body = doc.body;

    // Recursively convert elements to clean Markdown
    function convertNode(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Convert children recursively first
      let childrenContent = '';
      element.childNodes.forEach(child => {
        childrenContent += convertNode(child);
      });

      switch (tagName) {
        case 'h1':
          return `\n\n# ${childrenContent.trim()}\n\n`;
        case 'h2':
          return `\n\n## ${childrenContent.trim()}\n\n`;
        case 'h3':
          return `\n\n### ${childrenContent.trim()}\n\n`;
        case 'h4':
          return `\n\n#### ${childrenContent.trim()}\n\n`;
        case 'p':
          return `\n\n${childrenContent.trim()}\n\n`;
        case 'br':
          return '\n';
        case 'blockquote':
          return `\n\n> ${childrenContent.trim().split('\n').join('\n> ')}\n\n`;
        case 'strong':
        case 'b':
          return `**${childrenContent}**`;
        case 'em':
        case 'i':
          return `*${childrenContent}*`;
        case 'u':
          return `<u>${childrenContent}</u>`;
        case 's':
        case 'strike':
        case 'del':
          return `~~${childrenContent}~~`;
        case 'ul':
          return `\n\n${childrenContent.trim()}\n\n`;
        case 'ol':
          return `\n\n${childrenContent.trim()}\n\n`;
        case 'li': {
          const parent = element.parentElement;
          const isOrdered = parent && parent.tagName.toLowerCase() === 'ol';
          if (isOrdered) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element) + 1;
            return `${index}. ${childrenContent.trim()}\n`;
          }
          return `- ${childrenContent.trim()}\n`;
        }
        case 'div': {
          const text = childrenContent.trim();
          return text ? `\n${text}\n` : '';
        }
        case 'span': {
          const style = element.getAttribute('style') || '';
          let result = childrenContent;
          if (style.includes('font-weight: bold') || style.includes('font-weight: 700') || style.includes('font-weight: 800')) {
            result = `**${result}**`;
          }
          if (style.includes('font-style: italic')) {
            result = `*${result}*`;
          }
          if (style.includes('text-decoration: line-through') || style.includes('text-decoration-line: line-through')) {
            result = `~~${result}~~`;
          }
          if (style.includes('text-decoration: underline')) {
            result = `<u>${result}</u>`;
          }
          return result;
        }
        default:
          return childrenContent;
      }
    }

    let result = convertNode(body);

    // Clean up trailing and double-spaces/newlines
    result = result.replace(/&nbsp;/gi, ' ');
    result = result.trim();
    result = result.replace(/\n{3,}/g, '\n\n'); // Allow maximum of two adjacent newlines

    return result;
  } catch (error) {
    // Graceful fallback to rich regex replacement if DOMParser fails
    console.error("DOMParser markdown conversion error: ", error);
    let markdown = cleanedHtml;
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, p1) => {
      return p1.trim().split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n';
    });
    markdown = markdown.replace(/<ul>([\s\S]*?)<\/ul>/gi, (match, p1) => {
      return p1.replace(/<li>(.*?)<\/li>/gi, '- $1\n').trim() + '\n\n';
    });
    markdown = markdown.replace(/<ol>([\s\S]*?)<\/ol>/gi, (match, p1) => {
      let index = 1;
      return p1.replace(/<li>(.*?)<\/li>/gi, () => `${index++}. $1\n`).trim() + '\n\n';
    });
    markdown = markdown.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    markdown = markdown.replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>');
    markdown = markdown.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
    markdown = markdown.replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~');
    return markdown.trim().replace(/\n{3,}/g, '\n\n');
  }
}

/**
 * Very robust client-side Markdown to HTML parser to render formatting.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Headings
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

  // Unordered list items (gathers contiguous lines and wraps them in <ul>)
  html = html.replace(/^(?:-|\*)\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

  // Inline formatting
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Paragraphs (split by double newline)
  const lines = html.split(/\n\n+/);
  const formattedLines = lines.map(line => {
    line = line.trim();
    if (!line) return '';
    // If it already is a block element, don't wrap in <p>
    if (line.startsWith('<h1>') || line.startsWith('<h2>') || line.startsWith('<h3>') || 
        line.startsWith('<blockquote>') || line.startsWith('<ul>') || line.startsWith('<ol>')) {
      return line;
    }
    return `<p>${line.replace(/\n/g, '<br>')}</p>`;
  });

  const rawHtml = formattedLines.filter(Boolean).join('');
  return cleanHTML(rawHtml);
}

/**
 * Maps a Korean/Custom Category to a safe, clean English filename stub
 */
export function getCategorySlug(category: string): string {
  const clean = category.trim();
  if (!clean || clean === '일반 일기' || clean === '일상' || clean === '일기') return '';
  
  const mapping: Record<string, string> = {
    '독서록': 'book', // Default map독서록 to 'book' consistent with YYYY-MM-DD_book.md
    '업무 기록': 'work-log',
    '업무': 'work-log',
    '공부': 'study-log',
    '공부 기록': 'study-log',
    '여행': 'travel',
    '운동': 'fitness',
    '식단': 'diet',
    '일기장': ''
  };
  
  if (mapping[clean] !== undefined) {
    return mapping[clean];
  }
  
  // Clean special characters for safe filenames
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_-]/g, '')
    .substring(0, 30);
}
