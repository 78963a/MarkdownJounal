/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiaryEntry {
  id?: number;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "오전 11:15" or "오후 09:15" (formatted like the attachment)
  category: string;   // "일반 일기", "독서록", "업무 기록" etc.
  title: string;      // Title of the entry (optional)
  content: string;    // Rich text HTML/Markdown content
  tags: string[];     // Tag list representation
  createdAt: number;  // timestamp for sorting secondary
}

export type ActiveTab = 'feed' | 'calendar' | 'write' | 'search' | 'save';

export interface DownloadHistory {
  id: string;
  timestamp: number;
  periodStart: string;
  periodEnd: string;
  type: 'single' | 'range' | 'all';
  entryCount: number;
  fileName: string;
}

export interface CategorySpec {
  name: string;
  slug: string;
  color: string;      // Tailwind representation color for badge
}
