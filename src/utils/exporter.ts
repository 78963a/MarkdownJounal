/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiaryEntry } from '../types';
import { getCategorySlug, htmlToMarkdown } from './markdown';
import JSZip from 'jszip';

export interface CompiledMarkdownFile {
  filename: string;
  content: string;
}

/**
 * Groups and compiles diary entries into Markdown files based on dates and categories.
 */
export function compileEntriesToMarkdown(
  entries: DiaryEntry[], 
  categorySlugs?: Record<string, string>
): CompiledMarkdownFile[] {
  // Group entries
  // Key format: "YYYY-MM-DD|[category]"
  const groups: Record<string, DiaryEntry[]> = {};

  for (const entry of entries) {
    const catName = entry.category === '일반 일기' ? '일상' : entry.category;
    
    let slug = '';
    if (categorySlugs && categorySlugs[catName] !== undefined) {
      slug = categorySlugs[catName];
    } else {
      slug = getCategorySlug(catName);
    }
    
    // If slug is empty list, it's grouped under empty string (creates standard yyyy-MM-DD.md)
    const key = `${entry.date}|${slug}`;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  const files: CompiledMarkdownFile[] = [];

  for (const [key, groupEntries] of Object.entries(groups)) {
    const [date, slug] = key.split('|');
    
    // Sort group entries chronological
    groupEntries.sort((a, b) => {
      // compare time or createdAt
      return a.createdAt - b.createdAt;
    });

    // Create file name
    let filename = `${date}.md`;
    if (slug) {
      if (slug.startsWith('_') || slug.startsWith('-')) {
        filename = `${date}${slug}.md`;
      } else {
        filename = `${date}_${slug}.md`;
      }
    }

    // Construct highly-aesthetic Markdown content
    let mdContent = `# ${date} 일기 기록\n\n`;
    if (slug) {
      const catName = groupEntries[0].category === '일반 일기' ? '일상' : groupEntries[0].category;
      mdContent = `# ${date} 기록 - ${catName}\n\n`;
    }

    for (let i = 0; i < groupEntries.length; i++) {
      const entry = groupEntries[i];
      const timeStr = entry.time || '기록 시간 미선정';
      const titleStr = entry.title ? ` • ${entry.title}` : '';
      
      mdContent += `## 🕒 ${timeStr}${titleStr}\n`;
      const catDisplay = entry.category === '일반 일기' ? '일상' : entry.category;
      if (catDisplay && catDisplay !== '일상') {
        mdContent += `**태그별 분류**: \`${catDisplay}\`  \n`;
      }
      
      const markdownBody = htmlToMarkdown(entry.content);
      mdContent += `${markdownBody}\n\n`;

      if (entry.tags && entry.tags.length > 0) {
        mdContent += `**태그**: ${entry.tags.map(t => `#${t}`).join(', ')}  \n`;
      }

      // Separator between multiple items in the same day
      if (i < groupEntries.length - 1) {
        mdContent += `---\n\n`;
      }
    }

    files.push({
      filename,
      content: mdContent.trim()
    });
  }

  return files;
}

/**
 * Triggers a browser download of a single text file
 */
export function downloadSingleFile(filename: string, text: string) {
  const element = document.createElement('a');
  const file = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * Compiles all diaries and downloads them as a single ZIP file containing separate standard/category .md files.
 */
export async function downloadAllAsZip(entries: DiaryEntry[], categorySlugs?: Record<string, string>) {
  if (entries.length === 0) return;

  const files = compileEntriesToMarkdown(entries, categorySlugs);
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.content);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const element = document.createElement('a');
  element.href = URL.createObjectURL(content);

  const todayStr = new Date().toISOString().split('T')[0];
  element.download = `마크다운_일기장_백업_${todayStr}.zip`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
