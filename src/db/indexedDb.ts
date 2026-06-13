/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiaryEntry } from '../types';

const DB_NAME = 'DiaryAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'diaries';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export async function addDiary(entry: Omit<DiaryEntry, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(entry);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function updateDiary(entry: DiaryEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteDiary(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getAllDiaries(): Promise<DiaryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort newest to oldest as a default convenience
      const result = request.result as DiaryEntry[];
      result.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.createdAt - a.createdAt;
      });
      resolve(result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function seedInitialData(): Promise<void> {
  const diaries = await getAllDiaries();
  if (diaries.length > 0) return; // already has data

  // Seed with some nice default samples mirroring attachment screens
  const samples: Omit<DiaryEntry, 'id'>[] = [
    {
      date: '2026-06-10',
      time: '오전 6:23',
      category: '일상',
      title: '아침 운동 달리기',
      content: '<p>아침운동은 15분달리기를 연속 두 번 했다. 거의 쉬지 않고 달렸다.</p>',
      tags: ['운동', '달리기'],
      createdAt: Date.now() - 1000 * 60 * 60 * 26
    },
    {
      date: '2026-06-08',
      time: '오후 4:30',
      category: '독서록',
      title: '데미안을 읽고',
      content: '<p>새는 알에서 나오려고 투쟁한다. 알은 세계이다. 태어나려는 자는 하나의 세계를 깨뜨려야 한다. 싱클레어의 자아 성찰과 성장을 보며 나의 삶을 돌아본다.</p>',
      tags: ['독서', '인생', '데미안'],
      createdAt: Date.now() - 1000 * 60 * 60 * 65
    },
    {
      date: '2026-06-05',
      time: '오전 10:00',
      category: '업무 기록',
      title: '프로젝트 킥오프 미팅',
      content: '<p>신규 마크다운 일기장 프로젝트 킥오프.<br>주요 기능 확인:<br>- 로컬 인덱스드 DB 영속성<br>- 태그, 검색, 카테고리 기분류<br>- 마크다운 압축 다운로드 기능</p>',
      tags: ['업무', '개발', '회의'],
      createdAt: Date.now() - 1000 * 60 * 60 * 150
    }
  ];

  for (const sample of samples) {
    await addDiary(sample);
  }
}
