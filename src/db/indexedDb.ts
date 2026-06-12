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
      date: '2026-06-11',
      time: '오전 11:15',
      category: '일상',
      title: '거실 골판지 상자 정리',
      content: '<p>거실 종이상자 하나 정리했다. 버린건 거의 없어도 그래도 뭐라도 해야지.</p><p>일기 백업방식네 대해서 제미나이와 상담하니까 마크다운 파일 생성을 추천해준다. 기왕하는거 일기장 앱도 하나 만들까 싶다.</p><p>부엌 거실 복도 청소기로 한번씩 미니까 깨끗하다...</p>',
      tags: ['일상', '청소', '아이디어'],
      createdAt: Date.now() - 1000 * 60 * 30
    },
    {
      date: '2026-06-10',
      time: '오후 9:15',
      category: '일상',
      title: '준수방 청소와 저녁 식사',
      content: '<p>준수랑 70여분에 걸쳐서 준수방 청소했다. 준수가 처음에 100개 치우면 깨끗해질 거 같다고 해서 같이 100개 치워봤는데 역시나 택도 없었다. 더이상은 무리일거 같아서 100개까지만 치웠다.</p><p>저녁은 소고기구이와 닭고기무조림.</p><p>배터지게 먹었다....</p>',
      tags: ['육아', '집안일', '식단'],
      createdAt: Date.now() - 1000 * 60 * 60 * 14
    },
    {
      date: '2026-06-10',
      time: '오전 8:54',
      category: '일상',
      title: '체중계 불신',
      content: '<p>몸무게 56.20. 흠...(체중계를 불신하기 시작)</p>',
      tags: ['건강', '몸무게'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24
    },
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
