/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiaryEntry } from '../types';
import { getCategorySlug, htmlToMarkdown } from './markdown';
import JSZip from 'jszip';

/**
 * Converts a 12-hour or arbitrary time string to 24-hour style (HH:mm)
 */
function convertTo24Hour(timeStr: string): string {
  if (!timeStr) return '00:00';
  
  const pureTimeRegex = /^(\d{1,2}):(\d{2})$/;
  const matchPure = timeStr.trim().match(pureTimeRegex);
  if (matchPure) {
    const hh = String(Number(matchPure[1])).padStart(2, '0');
    const mm = matchPure[2];
    return `${hh}:${mm}`;
  }

  const ampmRegex = /(오전|오후)\s*(\d{1,2}):(\d{2})/;
  const matchAmpm = timeStr.trim().match(ampmRegex);
  if (matchAmpm) {
    const isPm = matchAmpm[1] === '오후';
    let hours = Number(matchAmpm[2]);
    const minutes = matchAmpm[3];

    if (isPm) {
      if (hours < 12) {
        hours += 12;
      }
    } else {
      if (hours === 12) {
        hours = 0;
      }
    }
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return timeStr;
}

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

    // Construct Obsidian-compatible frontmatter & visual block Markdown style
    let mdContent = `---\ndate: ${date}\n---\n\n`;

    for (let i = 0; i < groupEntries.length; i++) {
      const entry = groupEntries[i];
      const timeStr = convertTo24Hour(entry.time || '00:00');
      
      let headerLine = `## 🕒 ${timeStr}`;
      if (entry.title && entry.title.trim()) {
        headerLine += ` - ${entry.title.trim()}`;
      }
      mdContent += `${headerLine}\n`;
      
      const markdownBody = htmlToMarkdown(entry.content);
      mdContent += `${markdownBody}\n`;

      // Build category and tag list
      const catDisplay = entry.category === '일반 일기' || entry.category === '일상' ? '일상' : entry.category;
      const allTags = new Set<string>();
      if (catDisplay) {
        allTags.add(catDisplay);
      }
      if (entry.tags && entry.tags.length > 0) {
        entry.tags.forEach(t => allTags.add(t));
      }

      if (allTags.size > 0) {
        const tagLine = Array.from(allTags).map(t => `#${t}`).join(' ');
        mdContent += `${tagLine}\n`;
      }

      // Separator between multiple items in the same day
      if (i < groupEntries.length - 1) {
        mdContent += `\n`;
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
