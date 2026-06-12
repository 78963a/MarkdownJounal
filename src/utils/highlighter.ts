/**
 * Safe HTML string highlighter that targets ONLY visible text content.
 * Completely avoids corrupting HTML tag structures, class names, styles, or references.
 */
export function highlightHTML(html: string, keyword: string): string {
  if (!keyword || !keyword.trim()) return html;
  const trimmed = keyword.trim();
  
  try {
    // Create DOM Parser to operate on HTML elements
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Select all text nodes under body
    const walk = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    const nodesToReplace: { node: Text; parent: Node; newNodes: Node[] }[] = [];
    
    let textNode: Text | null = null;
    const escapedKeyword = escapedRegexPattern(trimmed);
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    
    while ((textNode = walk.nextNode() as Text | null)) {
      const parent = textNode.parentNode;
      if (!parent) continue;
      
      // Skip replacing inside formatting elements like MARK itself or scripting tags
      if (
        parent.nodeName === 'MARK' || 
        parent.nodeName === 'SCRIPT' || 
        parent.nodeName === 'STYLE' || 
        parent.nodeName === 'TEXTAREA'
      ) {
        continue;
      }
      
      const text = textNode.nodeValue || '';
      if (regex.test(text)) {
        regex.lastIndex = 0;
        const parts = text.split(regex);
        const newNodes: Node[] = [];
        
        parts.forEach(part => {
          if (part.toLowerCase() === trimmed.toLowerCase()) {
            const mark = doc.createElement('mark');
            // Stylized yellow translucent highlighter with a small underline accent and high contrast text
            mark.className = 'highlighted-keyword';
            mark.style.backgroundColor = 'rgba(253, 224, 71, 0.45)'; // trans yellow-300
            mark.style.backgroundImage = 'linear-gradient(to top, rgba(253, 224, 71, 0.8) 40%, transparent 40%)';
            mark.style.color = '#1c1917'; // stone-900
            mark.style.borderRadius = '4px';
            mark.style.padding = '1px 3px';
            mark.style.fontWeight = '800';
            mark.style.boxShadow = '0 1px 2px rgba(253, 224, 71, 0.2)';
            mark.textContent = part;
            newNodes.push(mark);
          } else if (part) {
            newNodes.push(doc.createTextNode(part));
          }
        });
        
        nodesToReplace.push({ node: textNode, parent, newNodes });
      }
    }
    
    // Execute replacement list sequentially
    nodesToReplace.forEach(({ node, parent, newNodes }) => {
      newNodes.forEach(newNode => parent.insertBefore(newNode, node));
      parent.removeChild(node);
    });
    
    return doc.body.innerHTML;
  } catch (err) {
    console.error('Error during highlighting syntax parsing:', err);
    return html;
  }
}

function escapedRegexPattern(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
