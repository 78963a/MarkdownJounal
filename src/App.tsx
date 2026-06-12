/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Tag as TagIcon,
  Download, 
  Trash2, 
  Edit3, 
  Clock, 
  FileText, 
  FolderPlus,
  AlertTriangle,
  FolderDot,
  CheckCircle2,
  X,
  FileDown,
  ArrowBigRightDash,
  HelpCircle,
  Hash,
  Sparkles,
  Home,
  Pencil,
  Check,
  History
} from 'lucide-react';
import { DiaryEntry, ActiveTab, CategorySpec, DownloadHistory } from './types';
import { getAllDiaries, addDiary, updateDiary, deleteDiary, seedInitialData } from './db/indexedDb';
import { compileEntriesToMarkdown, downloadSingleFile, downloadAllAsZip, downloadRangeAsZip } from './utils/exporter';
import { getCategorySlug } from './utils/markdown';
import Editor from './components/Editor';
import CalendarView from './components/CalendarView';
import TimeWheelPicker from './components/TimeWheelPicker';
import DateSelectionPicker from './components/DateSelectionPicker';
import { highlightHTML } from './utils/highlighter';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // DB Entries
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Record<number, boolean>>({});

  // Range and download history states
  const [rangeStartDate, setRangeStartDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [rangeEndDate, setRangeEndDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistory[]>(() => {
    try {
      const saved = localStorage.getItem('diary_download_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse download history', e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('diary_download_history', JSON.stringify(downloadHistory));
  }, [downloadHistory]);

  const addDownloadHistoryRecord = (
    type: 'single' | 'range' | 'all',
    startDate: string,
    endDate: string,
    entryCount: number,
    fileName: string
  ) => {
    const newRecord: DownloadHistory = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      periodStart: startDate,
      periodEnd: endDate,
      type,
      entryCount,
      fileName
    };
    setDownloadHistory(prev => [newRecord, ...prev]);
  };


  // Dynamic categories with state & localStorage backup
  const [categories, setCategories] = useState<CategorySpec[]>(() => {
    const saved = localStorage.getItem('diary_categories_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(c => {
            if (c.name === '일반 일기') {
              return { ...c, name: '일상', slug: '' };
            }
            return c;
          });
        }
      } catch (e) {
        console.error("Failed parsing localStorage categories", e);
      }
    }
    return [
      { name: '일상', slug: '', color: 'bg-indigo-500' },
      { name: '독서록', slug: '_book', color: 'bg-emerald-500' },
      { name: '업무 기록', slug: '_work_log', color: 'bg-amber-500' },
    ];
  });

  // Local helper states for category editor (inside the popup modal)
  const [editingCategorySpec, setEditingCategorySpec] = useState<CategorySpec | null>(null);
  const [categoryInputName, setCategoryInputName] = useState('');
  const [categoryInputSlug, setCategoryInputSlug] = useState('');

  // Persist categories list on change
  useEffect(() => {
    localStorage.setItem('diary_categories_config', JSON.stringify(categories));
  }, [categories]);

  // Filter & Navigation states
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Reset expanded entries on tab or filter changes
  useEffect(() => {
    setExpandedEntries({});
  }, [activeTab, selectedCategory, selectedTag, searchQuery]);

  // Search bottom sheet states
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  // Form states for Create/Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('');
  const [formCategory, setFormCategory] = useState('일상');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [formTagsString, setFormTagsString] = useState('');

  // Writing UI popover / modal states
  const [activeCategoryModal, setActiveCategoryModal] = useState(false);
  const [activeTagModal, setActiveTagModal] = useState(false);
  const [activeDateModal, setActiveDateModal] = useState(false);
  const [activeTimeModal, setActiveTimeModal] = useState(false);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);

  // Character counter helper
  const getCharacterCount = (content: string) => {
    const stripped = (content || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return stripped.length;
  };

  // Date format helper (e.g. 2026-06-11 -> 2026년 6월 11일)
  const formatKoreanDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return `${year}년 ${month}월 ${day}일`;
  };

  // UI notification toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

  // Load diaries on init and seed if empty
  useEffect(() => {
    async function init() {
      try {
        await seedInitialData();
        const data = await getAllDiaries();
        const mappedData = data.map(entry => {
          if (entry.category === '일반 일기') {
            return { ...entry, category: '일상' };
          }
          return entry;
        });
        setEntries(mappedData);
      } catch (err) {
        console.error('Failed to init database', err);
        showToast('데이터베이스 초기화에 실패했습니다.', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Scroll to top of the page when active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const refreshDiaries = async () => {
    try {
      const data = await getAllDiaries();
      const mappedData = data.map(entry => {
        if (entry.category === '일반 일기') {
          return { ...entry, category: '일상' };
        }
        return entry;
      });
      setEntries(mappedData);
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Pre-fill time for new diary
  const getKoreanFormattedTime = (): string => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12; // first hour is 12
    return `${ampm} ${String(hours).padStart(2, '0')}:${minutes}`;
  };

  const checkIfContentEmpty = (html: string) => {
    if (!html) return true;
    const cleanText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
    return cleanText === '';
  };

  const handleExitWrite = () => {
    if (checkIfContentEmpty(formContent)) {
      setActiveTab('feed');
    } else {
      setShowDiscardConfirmModal(true);
    }
  };

  // Set form values for writing
  const handleOpenWrite = (prefilledDate?: string) => {
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setFormDate(prefilledDate || new Date().toISOString().split('T')[0]);
    setFormTime(getKoreanFormattedTime());
    const defaultCatName = categories[0]?.name || '일상';
    setFormCategory(defaultCatName);
    setCustomCategory('');
    setShowCustomCategoryInput(false);
    setFormTagsString('');
    setActiveTab('write');
  };

  // Edit existing diary entry
  const handleEditEntry = (entry: DiaryEntry) => {
    setEditingId(entry.id || null);
    setFormTitle(entry.title || '');
    setFormContent(entry.content || '');
    setFormDate(entry.date);
    setFormTime(entry.time);
    
    const entryCatName = entry.category === '일반 일기' ? '일상' : entry.category;
    const exists = categories.some(c => c.name === entryCatName);
    if (!exists) {
      const newCatSpec = { name: entryCatName, slug: '', color: 'bg-indigo-500' };
      setCategories(prev => [...prev, newCatSpec]);
    }
    setFormCategory(entryCatName);
    setCustomCategory('');
    setShowCustomCategoryInput(false);

    setFormTagsString(entry.tags.join(', '));
    setActiveTab('write');
  };

  // Category Mutation Handlers
  const handleDeleteCategory = async (catName: string) => {
    if (categories.length === 0 || catName === categories[0].name) {
      showToast('기본 카테고리는 삭제할 수 없습니다.', 'error');
      return;
    }
    if (!window.confirm(`'${catName}' 카테고리를 정말 삭제하시겠습니까? 관련 일기는 모두 '${categories[0].name}'(으)로 안전하게 분류됩니다.`)) {
      return;
    }
    const defaultCatName = categories[0].name;
    const updated = categories.filter(c => c.name !== catName);
    setCategories(updated);
    
    if (formCategory === catName) {
      setFormCategory(defaultCatName);
    }
    if (selectedCategory === catName) {
      setSelectedCategory(null);
    }

    try {
      let count = 0;
      const allDiaries = await getAllDiaries();
      for (const entry of allDiaries) {
        const entryCat = entry.category === '일반 일기' ? '일상' : entry.category;
        if (entryCat === catName) {
          entry.category = defaultCatName;
          await updateDiary(entry);
          count++;
        }
      }
      await refreshDiaries();
      showToast(`카테고리가 삭제되었으며 ${count}개의 일기가 기본분류 '${defaultCatName}'(으)로 일괄 변경되었습니다.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('카테고리 삭제 변경 중 오차가 발생했습니다.', 'error');
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string, newSlug: string) => {
    const finalNewName = newName.trim();
    const finalNewSlug = newSlug.trim().replace(/[^a-zA-Z0-9_\-]/g, '');

    if (!finalNewName) {
      showToast('카테고리 이름을 입력해주세요.', 'error');
      return;
    }

    // Check duplicates
    const duplicate = categories.some(c => c.name !== oldName && c.name.toLowerCase() === finalNewName.toLowerCase());
    if (duplicate) {
      showToast('이미 존재하는 카테고리 이름입니다.', 'error');
      return;
    }

    const updated = categories.map(c => {
      if (c.name === oldName) {
        return { ...c, name: finalNewName, slug: finalNewSlug };
      }
      return c;
    });
    setCategories(updated);

    if (formCategory === oldName) {
      setFormCategory(finalNewName);
    }
    if (selectedCategory === oldName) {
      setSelectedCategory(finalNewName);
    }

    try {
      let count = 0;
      const allDiaries = await getAllDiaries();
      for (const entry of allDiaries) {
        const entryCat = entry.category === '일반 일기' ? '일상' : entry.category;
        if (entryCat === oldName) {
          entry.category = finalNewName;
          await updateDiary(entry);
          count++;
        }
      }
      await refreshDiaries();
      if (count > 0) {
        showToast(`카테고리가 '${finalNewName}'(으)로 변경되었고, ${count}개의 기존 일기도 업데이트되었습니다.`, 'success');
      } else {
        showToast(`카테고리가 수정되었습니다.`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('카테고리 일괄 갱신 도중 오류가 발생했습니다.', 'error');
    }
  };

  const handleSaveOrAddCategory = async () => {
    const finalName = categoryInputName.trim();
    const finalSlug = categoryInputSlug.trim().replace(/[^a-zA-Z0-9_\-]/g, '');

    if (!finalName) {
      showToast('카테고리 이름을 입력해주세요.', 'error');
      return;
    }

    if (editingCategorySpec) {
      // Edit mode
      await handleRenameCategory(editingCategorySpec.name, finalName, finalSlug);
      setEditingCategorySpec(null);
    } else {
      // Add mode
      const exists = categories.some(c => c.name.toLowerCase() === finalName.toLowerCase());
      if (exists) {
        showToast('이미 존재하는 카테고리 이름입니다.', 'error');
        return;
      }

      const colors = ['bg-[#599e52]', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500', 'bg-fuchsia-500'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newCat: CategorySpec = {
        name: finalName,
        slug: finalSlug,
        color: randomColor
      };

      setCategories(prev => [...prev, newCat]);
      setFormCategory(finalName);
      showToast(`'${finalName}' 카테고리가 새로 추가되었습니다.`, 'success');
    }

    setCategoryInputName('');
    setCategoryInputSlug('');
  };

  const handleCancelEditCategory = () => {
    setEditingCategorySpec(null);
    setCategoryInputName('');
    setCategoryInputSlug('');
  };

  // Delete handler
  const handleDeleteEntry = async (id: number) => {
    if (window.confirm('정말로 이 일기를 삭제하시겠습니까? 삭제된 일기는 복구할 수 없습니다.')) {
      try {
        await deleteDiary(id);
        showToast('일기가 정상적으로 삭제되었습니다.', 'success');
        refreshDiaries();
      } catch (err) {
        showToast('삭제 오류 발생', 'error');
      }
    }
  };

  // Submit / Save entry
  const handleSaveEntry = async (e: FormEvent) => {
    e.preventDefault();

    if (!formContent.replace(/<[^>]*>/g, '').trim()) {
      showToast('일기 내용을 입력해주세요!', 'error');
      return;
    }

    const finalCategory = formCategory;
    if (!finalCategory) {
      showToast('카테고리를 지정해주세요.', 'error');
      return;
    }

    // Process tag string (split by comma / space)
    const processedTags = formTagsString
      .split(/[,,| ]+/)
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const diaryPayload = {
      date: formDate,
      time: formTime || getKoreanFormattedTime(),
      category: finalCategory,
      title: formTitle.trim(),
      content: formContent,
      tags: processedTags,
      createdAt: Date.now()
    };

    try {
      if (editingId !== null) {
        // Edit flow
        await updateDiary({
          id: editingId,
          ...diaryPayload
        });
        showToast('일기가 성공적으로 수정되었습니다!', 'success');
      } else {
        // Create flow
        await addDiary(diaryPayload);
      }

      // Reset filters and navigate back
      setSearchQuery('');
      setSelectedCategory(null);
      setSelectedTag(null);
      refreshDiaries();
      setActiveTab('feed');
    } catch (err) {
      console.error(err);
      showToast('저장 중 오인 오류가 발생했습니다.', 'error');
    }
  };

  // Compile unique lists of active categories
  const categoriesMap: Record<string, number> = {};
  const tagsMap: Record<string, number> = {};

  entries.forEach(entry => {
    // Categories
    const cat = entry.category || '일반 일기';
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;

    // Tags
    if (entry.tags && Array.isArray(entry.tags)) {
      entry.tags.forEach(tag => {
        tagsMap[tag] = (tagsMap[tag] || 0) + 1;
      });
    }
  });

  // Filter entries dynamically
  const filteredEntries = entries.filter(entry => {
    // Search Term match content, title, tags or category
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      entry.title.toLowerCase().includes(query) || 
      entry.category.toLowerCase().includes(query) || 
      entry.content.toLowerCase().includes(query) ||
      entry.tags.some(t => t.toLowerCase().includes(query));

    const matchesCategory = !selectedCategory || entry.category === selectedCategory;
    const matchesTag = !selectedTag || entry.tags.includes(selectedTag);

    return matchesSearch && matchesCategory && matchesTag;
  });

  // Exporter triggers
  const getCategorySlugsMap = () => {
    return categories.reduce<Record<string, string>>((acc, cat) => {
      const catName = cat.name === '일반 일기' ? '일상' : cat.name;
      acc[catName] = cat.slug;
      return acc;
    }, {});
  };

  const handleDownloadAllZip = async () => {
    if (entries.length === 0) {
      showToast('다운로드할 일기가 존재하지 않습니다.', 'error');
      return;
    }
    try {
      showToast('마크다운 파일 압축 생성을 시작합니다...', 'info');
      const categorySlugsMap = getCategorySlugsMap();
      await downloadAllAsZip(entries, categorySlugsMap);
      showToast('마크다운 백업 압축파일이 다운로드되었습니다!', 'success');
      
      const sortedDates = [...entries].map(e => e.date).sort();
      const minDate = sortedDates[0] || '';
      const maxDate = sortedDates[sortedDates.length - 1] || '';
      const todayStr = new Date().toISOString().split('T')[0];
      const fn = `마크다운_일기장_백업_${todayStr}.zip`;
      addDownloadHistoryRecord('all', minDate, maxDate, entries.length, fn);
    } catch (e) {
      showToast('다운로드 도중 에러가 발생했습니다.', 'error');
    }
  };

  const handleDownloadRangeZip = async () => {
    if (!rangeStartDate || !rangeEndDate) {
      showToast('시작일과 종료일을 모두 선택해주세요.', 'error');
      return;
    }
    if (rangeStartDate > rangeEndDate) {
      showToast('시작일이 종료일보다 늦을 수 없습니다.', 'error');
      return;
    }

    const rangeEntries = entries.filter(e => e.date >= rangeStartDate && e.date <= rangeEndDate);
    if (rangeEntries.length === 0) {
      showToast('선택한 기간 내에 작성된 일기가 존재하지 않습니다.', 'error');
      return;
    }

    try {
      showToast('선택 기간 마크다운 압축 생성을 시작합니다...', 'info');
      const categorySlugsMap = getCategorySlugsMap();
      await downloadRangeAsZip(rangeEntries, rangeStartDate, rangeEndDate, categorySlugsMap);
      showToast('선택 기간 마크다운 백업 압축파일이 다운로드되었습니다!', 'success');

      const fn = `마크다운_일기장_백업_${rangeStartDate}_~_${rangeEndDate}.zip`;
      addDownloadHistoryRecord('range', rangeStartDate, rangeEndDate, rangeEntries.length, fn);
    } catch (e) {
      showToast('다운로드 도중 에러가 발생했습니다.', 'error');
    }
  };

  const handleDownloadSingleEntryAndGroup = (date: string, entryCategory: string) => {
    const subEntries = entries.filter(e => e.date === date && e.category === entryCategory);
    if (subEntries.length === 0) return;

    const categorySlugsMap = getCategorySlugsMap();
    const files = compileEntriesToMarkdown(subEntries, categorySlugsMap);
    if (files.length > 0) {
      const { filename, content } = files[0];
      downloadSingleFile(filename, content);
      showToast(`${filename} 파일이 다운로드 되었습니다!`, 'success');

      addDownloadHistoryRecord('single', date, date, subEntries.length, filename);
    }
  };


  // Reset all tags/category filters
  const handleClearFilters = () => {
    setSelectedCategory(null);
    setSelectedTag(null);
    setSearchQuery('');
  };

  return (
    <div className="h-[100dvh] w-full bg-[#f3f7f2] flex flex-col font-sans overflow-hidden relative" id="app-root-container">
      
      {/* Main Content Layout Block */}
      <main className={`flex-1 max-w-2xl w-full mx-auto flex flex-col ${activeTab === 'write' ? 'h-full overflow-hidden p-0' : 'overflow-y-auto p-1.5 pb-24'}`} id="main-content-flow">
        


        {/* LOADING STATE Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500" id="spinner-loading">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-semibold">데이터베이스를 가져오는 중입니다...</p>
          </div>
        ) : (
          <div id="active-tab-container" className={activeTab === 'write' ? 'flex-1 h-full flex flex-col min-h-0' : ''}>
            
            {/* 1. FEED VIEW TABLE (Chronological List view requested in Attachment 1) */}
            {activeTab === 'feed' && (
              <div className="flex flex-col gap-1.5" id="view-feed-section">
                
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => {
                    // split date to parts
                    const dateParts = entry.date.split('-');
                    const yearNum = dateParts[0];
                    const monthNum = parseInt(dateParts[1], 10);
                    const dayNum = parseInt(dateParts[2], 10);
                    
                    // day of week
                    const dObj = new Date(entry.date);
                    const weekStr = ['일', '월', '화', '수', '목', '금', '토'][dObj.getDay()];

                    return (
                      <motion.div
                        layout
                        key={entry.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex bg-white rounded-3xl border border-[#e2e8f0] [box-shadow:0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden transition-all hover:border-[#6ac05e]/50 hover:[box-shadow:0_8px_24px_rgba(0,0,0,0.05)]"
                        id={`diary-card-${entry.id}`}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                      >
                        {/* Left column replicating visual pattern in screenshot */}
                        <motion.div 
                          layout="position"
                          className="w-16 md:w-[74px] bg-[#f8faf8] border-r border-[#e2e8f0] flex flex-col items-center justify-center py-2 select-none text-[#599e52] gap-1"
                        >
                          {/* 연도 - 아주 작게 회색 */}
                          <span className="text-[10px] text-gray-400 font-mono font-bold leading-none">{yearNum}</span>
                          {/* 월 - 날짜와 같은색에 날짜보다는 조금 작게 */}
                          <span className="text-lg md:text-xl font-bold font-mono leading-none">{monthNum}</span>
                          {/* 일 - 원래 크고 두꺼운 스타일 */}
                          <span className="text-[28px] md:text-3xl font-black font-mono leading-none tracking-tight">{dayNum}</span>
                          {/* 요일 - 수, 목 같은 한글자만 */}
                          <span className="text-xs text-gray-400 font-semibold">{weekStr}</span>
                        </motion.div>

                        {/* Content & Action Area */}
                        <motion.div layout="position" className="flex-1 p-2.5 flex flex-col justify-between">
                          <div>
                            {/* Metadata line standard with category budget on top-right */}
                            <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                              <span className="flex items-center gap-1 bg-gray-50 p-1 px-2.5 rounded-full border border-gray-100">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span>{entry.time}</span>
                              </span>
                              {entry.category && (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const catName = entry.category === '일반 일기' ? '일상' : entry.category;
                                    if (selectedCategory === catName) {
                                      setSelectedCategory(null);
                                    } else {
                                      setSelectedCategory(catName);
                                    }
                                  }}
                                  className={`px-2.5 py-0.5 text-[10px] font-extrabold text-white rounded-lg select-none uppercase tracking-wide shadow-xs cursor-pointer active:scale-95 hover:brightness-90 transition-all ${
                                    (() => {
                                      const entryCat = entry.category === '일반 일기' ? '일상' : entry.category;
                                      const spec = categories.find(c => c.name === entryCat);
                                      return spec ? spec.color : 'bg-indigo-500';
                                    })()
                                  }`}
                                  title={`${entry.category === '일반 일기' ? '일상' : entry.category} 카테고리 필터링`}
                                >
                                  {entry.category === '일반 일기' ? '일상' : entry.category}
                                </span>
                              )}
                            </div>

                            {entry.title && entry.title.trim() && (
                              <h3 
                                className="text-base md:text-lg font-black text-gray-800 mb-1.5 leading-tight text-left"
                                id={`diary-title-${entry.id}`}
                              >
                                {entry.title}
                              </h3>
                            )}

                            {/* Main Body with HTML parser */}
                            {(() => {
                              const cleanText = entry.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                              const isLong = cleanText.length > 140;
                              const isExpanded = expandedEntries[entry.id];

                              if (isLong) {
                                return (
                                  <div className="text-base md:text-lg text-gray-700 leading-relaxed max-w-none prose prose-p:my-0.5 mb-1.5 select-text overflow-hidden">
                                    <motion.div
                                      layout="position"
                                      className="overflow-hidden"
                                    >
                                      {!isExpanded ? (
                                        <div>
                                          <span dangerouslySetInnerHTML={{ __html: highlightHTML(cleanText.slice(0, 140) + '...', searchQuery) }} />
                                          <button
                                            type="button"
                                            onClick={() => setExpandedEntries(prev => ({ ...prev, [entry.id]: true }))}
                                            className="text-rose-600 font-extrabold hover:text-rose-800 transition cursor-pointer inline-flex items-center gap-1 select-none text-sm ml-1.5 hover:underline"
                                          >
                                            ▼ 더보기 ▼
                                          </button>
                                        </div>
                                      ) : (
                                        <div>
                                          <div dangerouslySetInnerHTML={{ __html: highlightHTML(entry.content, searchQuery) }} />
                                          <div className="mt-2 text-right">
                                            <button
                                              type="button"
                                              onClick={() => setExpandedEntries(prev => {
                                                const updated = { ...prev };
                                                delete updated[entry.id];
                                                return updated;
                                              })}
                                              className="text-rose-600 font-extrabold hover:text-rose-800 transition cursor-pointer inline-flex items-center gap-1 select-none text-xs hover:underline"
                                            >
                                              ▲ 접기 ▲
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  className="text-base md:text-lg text-gray-700 leading-relaxed max-w-none prose prose-p:my-0.5 mb-1.5 select-text"
                                  dangerouslySetInnerHTML={{ __html: highlightHTML(entry.content, searchQuery) }}
                                />
                              );
                            })()}
                          </div>

                          {/* Footer Tags & Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f8fafc] pt-1.5">
                            {/* Interactive Tags */}
                            <div className="flex flex-wrap gap-1">
                              {entry.tags && entry.tags.length > 0 ? (
                                entry.tags.map(tag => (
                                  <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                    className="text-[11px] font-bold text-[#599e52] hover:text-[#7fbf78] bg-[#f0f9f0] hover:bg-emerald-50 px-2 py-1 rounded-full transition-colors"
                                    id={`tag-btn-entry-${entry.id}-${tag}`}
                                  >
                                    #{tag}
                                  </button>
                                ))
                              ) : (
                                <span className="text-xs text-gray-300 italic">태그 없음</span>
                              )}
                            </div>

                            {/* Inline operations */}
                            <div className="flex items-center gap-1.5 ml-auto">
                              {/* Single .md file download helper */}
                              <button
                                onClick={() => handleDownloadSingleEntryAndGroup(entry.date, entry.category)}
                                className="p-1 px-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 text-gray-500 hover:text-emerald-700 transition"
                                title="이 일기만 마크다운 파일로 다운로드하기"
                                id={`btn-dl-entry-${entry.id}`}
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="p-1.5 text-[#599e52] bg-emerald-50 hover:bg-[#599e52]/10 rounded-lg transition"
                                title="수정"
                                id={`btn-edit-entry-${entry.id}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id!)}
                                className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                                title="삭제"
                                id={`btn-delete-entry-${entry.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center bg-white rounded-3xl border border-[#e2e8f0] p-8 text-gray-500 shadow-sm" id="empty-feed">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-lg font-bold text-gray-700">작성된 일기가 없습니다!</p>
                    <p className="text-sm text-gray-400 mt-1.5 max-w-sm mx-auto">
                      첫 마줄에 기록된 추억이 보이지 않고 있습니다. 하단 자판 아이콘을 눌러 첫 일기를 작성해 보세요.
                    </p>
                    <button
                      onClick={() => handleOpenWrite()}
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#599e52] text-white rounded-2xl text-xs font-bold shadow hover:bg-[#4ba843] transition"
                      id="empty-feed-write-btn"
                    >
                      <Plus className="w-4 h-4" />
                      <span>새 일기 작성하기</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. CALENDAR VIEW (Attachment 2 view requested) */}
            {activeTab === 'calendar' && (
              <CalendarView
                entries={entries}
                onSelectEntry={handleEditEntry}
                onWriteForDate={(targetDate) => handleOpenWrite(targetDate)}
                onDeleteEntry={handleDeleteEntry}
                onDownloadSingleEntryAndGroup={handleDownloadSingleEntryAndGroup}
                searchQuery={searchQuery}
              />
            )}

            {/* 3. WRITE / EDIT VIEW (Word Processor Editor) */}
            {activeTab === 'write' && (
              <div className="bg-[#fcfbf9] w-full flex flex-col h-full overflow-hidden" id="write-section">
                <form onSubmit={handleSaveEntry} className="flex flex-col h-full w-full overflow-hidden">
                  
                  {/* Sticky top content headers - Rows 1 and 2 */}
                  <div className="flex-shrink-0 bg-white border-b border-stone-200/80 flex flex-col w-full select-none">
                    
                    {/* Row 1: Left: Check button & Character counter, Right: Category & Tags popovers */}
                    <div className="flex items-center justify-between p-2 px-3 bg-white border-b border-stone-100">
                      {/* Left aligned tools */}
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="w-10 h-10 flex items-center justify-center bg-[#599e52] hover:bg-[#4ba843] active:scale-95 text-white rounded-full shadow-xs transition-all cursor-pointer"
                          title="확인 및 저장하기"
                          id="btn-confirm-save-diary"
                        >
                          <Check className="w-5.5 h-5.5 stroke-[3px]" />
                        </button>
                        
                        <div className="flex items-center justify-center min-w-[40px] px-2.5 py-1 bg-stone-50 rounded-full border border-stone-100 text-[#599e52] font-mono text-xs md:text-sm font-black select-none" title="현재 글자수">
                          {getCharacterCount(formContent)}
                        </div>
                      </div>

                      {/* Right aligned tools */}
                      <div className="flex items-center gap-1.5">
                        {/* Category popover - Now Centered Modal */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategoryModal(true);
                              setActiveTagModal(false);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#599e52] text-xs font-black rounded-full border border-emerald-100 transition-all cursor-pointer"
                            id="write-category-popover-trigger"
                          >
                            <FolderDot className="w-3.5 h-3.5" />
                            <span>{formCategory}</span>
                          </button>
                          
                          {/* Centered Modal Overlay */}
                          {activeCategoryModal && (
                            <div 
                              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none" 
                              onClick={() => {
                                handleCancelEditCategory();
                                setActiveCategoryModal(false);
                              }}
                            >
                              <div 
                                className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-sm p-6 text-left flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between pb-2 border-b border-stone-150">
                                  <span className="text-base font-bold text-gray-800">일기 카테고리 선택 및 관리</span>
                                  <button type="button" onClick={() => {
                                    handleCancelEditCategory();
                                    setActiveCategoryModal(false);
                                  }} className="text-gray-400 hover:text-gray-600 p-1">
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                
                                {/* List of Categories */}
                                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                                  {categories.map((cat, index) => {
                                    const isSelected = formCategory === cat.name;
                                    const isDefault = index === 0; // First item is '일상'
                                    
                                    const filePreviewText = cat.slug 
                                      ? `YYYY-MM-DD${cat.slug.startsWith('_') || cat.slug.startsWith('-') ? cat.slug : '_' + cat.slug}.md` 
                                      : 'YYYY-MM-DD.md';

                                    return (
                                      <div 
                                        key={cat.name} 
                                        className={`flex items-center justify-between p-2.5 px-3 rounded-xl border transition-all ${
                                          isSelected 
                                            ? 'bg-emerald-50/70 border-emerald-200' 
                                            : 'bg-stone-50/50 border-stone-100 hover:bg-stone-50'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFormCategory(cat.name);
                                            setActiveCategoryModal(false);
                                          }}
                                          className="flex-1 flex flex-col text-left cursor-pointer"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${cat.color || 'bg-indigo-500'}`} />
                                            <span className="text-sm font-extrabold text-gray-800">{cat.name}</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-[#599e52] stroke-[3.5px]" />}
                                          </div>
                                          <span className="text-[10.5px] text-gray-400 font-mono mt-0.5">
                                            저장명: {filePreviewText}
                                          </span>
                                        </button>
                                        
                                        {/* Actions: Edit / Delete */}
                                        <div className="flex items-center gap-1 select-none">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingCategorySpec(cat);
                                              setCategoryInputName(cat.name);
                                              setCategoryInputSlug(cat.slug);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-[#599e52] hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="이름 및 파일 식별자 변경"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          {!isDefault && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteCategory(cat.name)}
                                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                              title="분류 제거"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Inline creator tool */}
                                <div className="p-3 bg-stone-50/80 border border-stone-100 rounded-2xl flex flex-col gap-2">
                                  <div className="text-xs font-bold text-gray-600 flex items-center justify-between select-none">
                                    <span>{editingCategorySpec ? '✏️ 카테고리 정보 수정' : '➕ 새 카테고리 추가'}</span>
                                    {editingCategorySpec && (
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setEditingCategorySpec(null);
                                          setCategoryInputName('');
                                          setCategoryInputSlug('');
                                        }}
                                        className="text-stone-400 hover:text-stone-600 text-[10px] underline"
                                      >
                                        취소
                                      </button>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-col gap-2 mt-1">
                                    <input
                                      type="text"
                                      placeholder="카테고리명 (예: 독서록, 일상)"
                                      value={categoryInputName}
                                      onChange={(e) => setCategoryInputName(e.target.value)}
                                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-base outline-none focus:ring-1.5 focus:ring-[#599e52]/40 font-semibold text-gray-800"
                                    />
                                    
                                    <div className="flex flex-col gap-1">
                                      <input
                                        type="text"
                                        placeholder="파일 접미사 식별자 (예: _book_review)"
                                        value={categoryInputSlug}
                                        onChange={(e) => setCategoryInputSlug(e.target.value)}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-base outline-none focus:ring-1.5 focus:ring-[#599e52]/40 font-mono text-gray-700"
                                      />
                                      
                                      {/* Live file preview text */}
                                      <div className="text-[10px] text-gray-400 font-mono scale-95 origin-left select-none leading-relaxed">
                                        백업 파일명: {formDate}
                                        <span className="text-[#599e52] font-extrabold font-mono">
                                          {categoryInputSlug 
                                            ? (categoryInputSlug.startsWith('_') || categoryInputSlug.startsWith('-') 
                                                ? categoryInputSlug 
                                                : '_' + categoryInputSlug) 
                                            : ''}
                                        </span>
                                        .md
                                      </div>
                                    </div>
                                    
                                    <button
                                      type="button"
                                      onClick={handleSaveOrAddCategory}
                                      className="w-full bg-[#599e52] hover:bg-[#4ba843] text-white text-xs font-bold py-1.5 rounded-lg transition-colors shadow-xs"
                                    >
                                      {editingCategorySpec ? '수정 완료' : '등록 및 분류추가'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tags popover - Now Centered Modal */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTagModal(true);
                              setActiveCategoryModal(false);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-full border border-indigo-100 transition-all cursor-pointer"
                            id="write-tag-popover-trigger"
                          >
                            <TagIcon className="w-3.5 h-3.5 text-indigo-500" />
                            <span>태그</span>
                          </button>
                          
                          {/* Centered Modal Overlay */}
                          {activeTagModal && (
                            <div 
                              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" 
                              onClick={() => setActiveTagModal(false)}
                            >
                              <div 
                                className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-sm p-6 text-left flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between pb-2 border-b border-stone-150">
                                  <span className="text-base font-bold text-gray-800">일기 태그 등록</span>
                                  <button type="button" onClick={() => setActiveTagModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-bold text-gray-500">태그 입력 (쉼표 또는 공백으로 분리)</label>
                                  <input
                                    type="text"
                                    placeholder="예: 홈카페, 소풍, 저녁식사"
                                    value={formTagsString}
                                    onChange={(e) => setFormTagsString(e.target.value)}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#599e52]/20 font-bold"
                                    id="popover-tag-text-input"
                                  />
                                </div>

                                <div className="flex flex-col gap-2">
                                  <span className="text-xs font-bold text-gray-500">기존 보관함 태그 터치 선택</span>
                                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                                    {Object.keys(tagsMap).map((tag) => {
                                      const currentTagsList = formTagsString.split(/[,,| ]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
                                      const isSelected = currentTagsList.includes(tag);
                                      return (
                                        <button
                                          key={tag}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              const updated = currentTagsList.filter(t => t !== tag);
                                              setFormTagsString(updated.join(', '));
                                            } else {
                                              const updated = [...currentTagsList, tag];
                                              setFormTagsString(updated.join(', '));
                                            }
                                          }}
                                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors border ${
                                            isSelected
                                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                              : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-emerald-300'
                                          }`}
                                        >
                                          #{tag}
                                        </button>
                                      );
                                    })}
                                    {Object.keys(tagsMap).length === 0 && (
                                      <p className="text-xs text-gray-400 py-1 text-center w-full">사용 중인 고유 태그가 없습니다.</p>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setActiveTagModal(false)}
                                  className="w-full bg-[#599e52] text-white text-sm font-bold py-2.5 rounded-xl text-center shadow-xs transition hover:bg-[#498a43]"
                                >
                                  태그 반영하기
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Unordered exit button to cancel */}
                        <button
                          type="button"
                          onClick={handleExitWrite}
                          className="w-9 h-9 flex items-center justify-center hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 transition"
                          title="뒤로 가기"
                          id="btn-top-write-back-arrow"
                        >
                          <X className="w-5.5 h-5.5" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Date & Time selector split row */}
                    <div className="grid grid-cols-2 bg-stone-50/70 border-t border-b border-stone-150 text-center text-xs font-bold text-gray-600">
                      {/* Left side: Date display */}
                      <div className="relative border-r border-stone-150">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDateModal(true);
                            setActiveTimeModal(false);
                            setActiveCategoryModal(false);
                            setActiveTagModal(false);
                          }}
                          className="w-full py-2 hover:bg-stone-100/80 flex items-center justify-center gap-1.5 transition-colors text-emerald-800 font-mono text-xs md:text-sm font-extrabold"
                          id="write-date-popover-trigger"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-[#599e52]" />
                          <span className="underline decoration-[#599e52]/50 underline-offset-4 decoration-[1.5px]">{formatKoreanDate(formDate)}</span>
                        </button>
                        
                        {activeDateModal && (
                          <div 
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none" 
                            onClick={() => setActiveDateModal(false)}
                          >
                            <DateSelectionPicker
                              value={formDate}
                              onChange={setFormDate}
                              onClose={() => setActiveDateModal(false)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right side: Time display */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTimeModal(true);
                            setActiveDateModal(false);
                            setActiveCategoryModal(false);
                            setActiveTagModal(false);
                          }}
                          className="w-full py-2 hover:bg-stone-100/80 flex items-center justify-center gap-1.5 transition-colors text-emerald-800 font-mono text-xs md:text-sm font-extrabold"
                          id="write-time-popover-trigger"
                        >
                          <Clock className="w-3.5 h-3.5 text-[#599e52]" />
                          <span className="underline decoration-[#599e52]/50 underline-offset-4 decoration-[1.5px]">{formTime}</span>
                        </button>
                        
                        {activeTimeModal && (
                          <div 
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none" 
                            onClick={() => setActiveTimeModal(false)}
                          >
                            <TimeWheelPicker
                              value={formTime}
                              onChange={setFormTime}
                              onClose={() => setActiveTimeModal(false)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scrollable text areas including Editor (Row 3 toolbar is set to sticky within Editor) */}
                  <div className="flex-1 bg-[#fdfcf9] flex flex-col justify-between min-h-0" id="write-scroll-content">
                    <Editor
                      value={formContent}
                      onChange={setFormContent}
                      title={formTitle}
                      onChangeTitle={setFormTitle}
                      placeholder="이곳에 오늘 하루 있었던 소중한 순간들을 기록해보세요. 마크다운(#, **, -, > 등) 문법을 지원합니다. 언제든 우측 상단의 '미리보기' 버튼을 누르면 실시간 뷰로 확인할 수 있습니다."
                      borderless={true}
                      stickyTopClass="top-0"
                    />

                    {/* Selected Tags list in #tag format at the bottom */}
                    {formTagsString.split(/[,,| ]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean).length > 0 && (
                      <div className="px-5 py-3 border-t border-stone-150 bg-[#faf9f6]/80 flex flex-wrap items-center gap-1.5 select-none text-xs text-indigo-700 font-extrabold cursor-default" id="form-selected-tags-indicator-row">
                        <span className="text-gray-400 mr-1 font-bold">등록태그:</span>
                        {formTagsString.split(/[,,| ]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean).map((tag, i) => (
                          <span key={i} className="bg-indigo-50/70 border border-indigo-100/40 px-2 py-0.5 rounded-lg">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* 5. DOWNLOAD BACKUP EXPORTER */}
            {activeTab === 'save' && (
              <div className="flex flex-col gap-6 font-sans" id="exporter-sections">
                <div className="bg-white rounded-3xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col gap-6">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 pb-2.5 border-b border-gray-100">
                    <Download className="w-5 h-5 text-[#599e52]" />
                    <span>내 일기 마크다운(Markdown) 문서로 백업 저장</span>
                  </h3>
                  
                  <p className="text-xs text-gray-500 leading-relaxed -mt-3">
                    브라우저 내부 IndexedDB 영구 저장소에 저장된 일기 데이터들을 하루 단위의 개별 마크다운 파일로 패킹하여 다운로드 받을 수 있습니다.
                    독서록, 업무 기록과 같은 카테고리가 다른 파일은 별도로 나뉘어 압축됩니다.
                  </p>

                  <div className="bg-stone-50 border border-[#e2e8f0] p-4 rounded-2xl flex flex-col gap-2.5">
                    <h4 className="text-xs font-bold text-gray-700">백업 마크다운 저장 사양 안내 (기기 기반 동적 매핑)</h4>
                    <div className="text-[11px] text-gray-500 font-medium grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categories.map((cat, idx) => {
                        const catName = cat.name === '일반 일기' ? '일상' : cat.name;
                        const slug = cat.slug !== undefined ? cat.slug : getCategorySlug(catName);
                        
                        let filenameFormat = 'YYYY-MM-DD.md';
                        let badgeColor = 'text-indigo-600 bg-indigo-50 border-indigo-100';
                        
                        if (slug) {
                          if (slug.startsWith('_') || slug.startsWith('-')) {
                            filenameFormat = `YYYY-MM-DD${slug}.md`;
                          } else {
                            filenameFormat = `YYYY-MM-DD_${slug}.md`;
                          }
                          
                          if (slug === 'book') {
                            badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                          } else if (slug === 'work-log') {
                            badgeColor = 'text-amber-700 bg-amber-50 border-amber-100';
                          } else if (slug === 'study-log') {
                            badgeColor = 'text-cyan-700 bg-cyan-50 border-cyan-100';
                          } else {
                            badgeColor = 'text-purple-700 bg-purple-50 border-purple-100';
                          }
                        }

                        return (
                          <div key={cat.name || idx} className="flex flex-wrap items-center justify-between gap-1.5 bg-white px-3 py-2 rounded-xl border border-stone-200/50">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-gray-800 text-[11px]">{catName}</span>
                              {slug ? (
                                <span className="text-[9px] text-gray-400 font-mono font-bold bg-neutral-100 px-1 py-0.5 rounded">slug: {slug}</span>
                              ) : (
                                <span className="text-[9px] text-gray-450 font-mono font-bold bg-slate-100 px-1 py-0.5 rounded">기본</span>
                              )}
                            </div>
                            <code className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
                              {filenameFormat}
                            </code>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* All Backups block */}
                    <div className="border border-stone-200/60 rounded-2xl p-4 flex flex-col justify-between" id="save-all-container">
                      <div>
                        <h4 className="text-xs font-black text-gray-800 mb-2.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#599e52]"></span>
                          <span>방법 1. 전체 일기 내려받기</span>
                        </h4>
                        <p className="text-[11px] text-gray-550 leading-relaxed mb-4">
                          현재 기기 보관함의 전체 일기(<strong className="text-[#599e52]">{entries.length}개</strong>)를 한 번에 패킹해서 ZIP 마크다운 압축 파일로 일괄 소장합니다.
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleDownloadAllZip}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-[#599e52] hover:bg-[#4ca843] active:bg-[#3b8334] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                          id="btn-action-backup-zip"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>전체 일기 ZIP 다운로드</span>
                        </button>
                        <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">
                          기기 복구 보관에 안전하고 유용합니다.
                        </p>
                      </div>
                    </div>

                    {/* Period selection block */}
                    <div className="border border-stone-200/60 rounded-2xl p-4 flex flex-col justify-between" id="save-range-container">
                      <div>
                        <h4 className="text-xs font-black text-gray-800 mb-2.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#7c3aed]"></span>
                          <span>방법 2. 특정 기간 일기만 내려받기</span>
                        </h4>
                        <p className="text-[11px] text-gray-550 leading-relaxed mb-4">
                          원하는 기간 범위(시작일 ~ 종료일)를 직접 설정하여, 지정한 기간 내에 작성된 마크다운 일기만 부분 추출하여 내려받습니다.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 select-none">시작일</label>
                            <input
                              type="date"
                              value={rangeStartDate}
                              onChange={(e) => setRangeStartDate(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-gray-700 outline-none focus:border-[#7c3aed] transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 select-none">종료일</label>
                            <input
                              type="date"
                              value={rangeEndDate}
                              onChange={(e) => setRangeEndDate(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-gray-700 outline-none focus:border-[#7c3aed] transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleDownloadRangeZip}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                          id="btn-action-range-zip"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>선택 기간 ZIP 다운로드</span>
                        </button>
                        <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">
                          원하는 며칠 동안의 기록을 간편하게 별도 보관합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. DOWNLOAD CHRONOLOGICAL LOGS TABLE */}
                <div className="bg-white rounded-3xl border border-[#e2e8f0] p-6 shadow-sm overflow-hidden flex flex-col gap-4" id="backup-logs-card">
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      <History className="w-5 h-5 text-indigo-500" />
                      <span>최근 일기 백업 및 다운로드 이력</span>
                    </h3>
                    {downloadHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('다운로드 이력을 모두 초기화하시겠습니까? (실제 저장된 일기는 그대로 유지됩니다)')) {
                            setDownloadHistory([]);
                          }
                        }}
                        className="text-[10px] text-gray-400 hover:text-rose-500 transition-colors font-bold border border-gray-205 hover:border-rose-100 rounded-lg px-2.5 py-1 bg-gray-50/50 hover:bg-rose-50/25 cursor-pointer"
                        id="history-clear-btn"
                      >
                        이력 초기화
                      </button>
                    )}
                  </div>

                  {downloadHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-xs flex flex-col items-center justify-center gap-1 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200" id="empty-history-indicator">
                      <Clock className="w-7 h-7 text-stone-300 mb-1" />
                      <p className="font-extrabold text-[#78716c]">백업 또는 다운로드 이력이 아직 존재하지 않습니다.</p>
                      <p className="text-[10.5px] text-stone-400/80 leading-relaxed font-semibold">
                        전체/기간 압축 다운로드 혹은 개별 일기 카드의 폴더 내려받기 단추를 가동하여 백업을 개시해보세요.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-stone-200/70" id="history-logs-table-wrapper">
                      <table className="min-w-full table-auto divide-y divide-stone-200 text-left text-xs bg-transparent" id="backup-logs-table">
                        <thead>
                          <tr className="bg-stone-50 text-[11px] font-black text-gray-500 tracking-wider">
                            <th className="py-2.5 px-3 whitespace-nowrap">다운로드 일시</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">유형</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">대상 백업 일정</th>
                            <th className="py-2.5 px-3 whitespace-nowrap text-center">일기 수</th>
                            <th className="py-2.5 px-3 whitespace-nowrap max-w-[150px] truncate">파일명 / 크기</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-gray-700 font-semibold" id="backup-logs-table-body">
                          {downloadHistory.map((item) => {
                            const itemDate = new Date(item.timestamp);
                            const y = itemDate.getFullYear();
                            const m = String(itemDate.getMonth() + 1).padStart(2, '0');
                            const d = String(itemDate.getDate()).padStart(2, '0');
                            const hh = String(itemDate.getHours()).padStart(2, '0');
                            const mm = String(itemDate.getMinutes()).padStart(2, '0');
                            const formattedTime = `${y}.${m}.${d} ${hh}:${mm}`;

                            const typeBadge =
                              item.type === 'all' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/60">
                                  전체 백업
                                </span>
                              ) : item.type === 'range' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/60">
                                  기간 백업
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200/60">
                                  개별 일기
                                </span>
                              );

                            const periodLabel = 
                              item.type === 'all' 
                                ? `${item.periodStart.replace(/-/g, '.')} ~ ${item.periodEnd.replace(/-/g, '.')}`
                                : item.type === 'range'
                                  ? `${item.periodStart.replace(/-/g, '.')} ~ ${item.periodEnd.replace(/-/g, '.')}`
                                  : item.periodStart.replace(/-/g, '.');

                            return (
                              <tr key={item.id} className="hover:bg-stone-50/70 transition-colors" id={`log-row-${item.id}`}>
                                <td className="py-3 px-3 whitespace-nowrap text-[11px] font-mono text-gray-500 font-bold">
                                  {formattedTime}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {typeBadge}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap text-[11px] font-bold text-gray-800">
                                  {periodLabel}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap text-center font-bold text-slate-800">
                                  {item.entryCount}개
                                </td>
                                <td className="py-3 px-3 max-w-[155px] truncate text-[11px] font-mono text-gray-400 hover:text-gray-600 transition-colors" title={item.fileName}>
                                  {item.fileName}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-5 rounded-3xl" id="about-privacy">
                  <div className="flex gap-2 text-yellow-800">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold">오프라인 오버드라이브 개인정보 보호 정책</h4>
                      <p className="text-[11px] text-yellow-700 leading-relaxed mt-1">
                        작성하시는 소중한 다이어리 텍스트는 외부 서버에 절대 전송되지 않고 본인의 브라우저 내부 IndexedDB 영구 저장 영역에 보관됩니다. 인터넷 연결이 원활하지 않는 비행기, 터널 안 오프라인에서도 완전하게 작동합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Search & Explore Bottom Sheet */}
      <AnimatePresence>
        {isSearchSheetOpen && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1
            }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-[74px] left-0 right-0 z-40 max-w-2xl mx-auto px-4 select-none"
            id="search-bottom-sheet"
          >
            <div className="bg-white rounded-3xl border border-[#e2e8f0] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
              
              {/* Sheet Header Tab (Handlebar & Active Filters Display) */}
              <div 
                className="bg-stone-50/95 border-b border-stone-150 py-3 px-5 flex flex-col items-center cursor-pointer hover:bg-stone-100 transition-colors"
                onClick={() => setIsSheetExpanded(!isSheetExpanded)}
                id="bottom-sheet-drag-header"
              >
                {/* Drag Handle Indicator */}
                <div className="w-10 h-1 bg-stone-300 rounded-full mb-2.5" />

                <div className="w-full flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0 py-0.5">
                    {!(selectedCategory || selectedTag || searchQuery) ? (
                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                        <span>전체 일기 목록 조회 중 (필터 미지정)</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[#599e52] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex-shrink-0">
                          선택됨:
                        </span>
                        {searchQuery && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery('');
                            }}
                            className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors border border-stone-200"
                          >
                            <span>"{searchQuery}"</span>
                            <X className="w-2.5 h-2.5 text-stone-500 rounded-full p-0.5 hover:bg-stone-300" />
                          </span>
                        )}
                        {selectedCategory && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategory(null);
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors border border-emerald-200"
                          >
                            <span>분류: {selectedCategory}</span>
                            <X className="w-2.5 h-2.5 text-emerald-600 rounded-full p-0.5 hover:bg-emerald-200" />
                          </span>
                        )}
                        {selectedTag && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(null);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-150 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors border border-indigo-200"
                          >
                            <span>#{selectedTag}</span>
                            <X className="w-2.5 h-2.5 text-indigo-600 rounded-full p-0.5 hover:bg-indigo-200" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Clear all filters if any */}
                    {(selectedCategory || selectedTag || searchQuery) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearFilters();
                        }}
                        className="text-[10px] font-extrabold text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 px-2 rounded-lg transition-colors border border-rose-100 bg-white"
                        title="모든 필터 초기화"
                      >
                        지우기
                      </button>
                    )}
                    
                    {/* Toggle Button */}
                    <span className="text-[10px] font-bold text-[#599e52] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg">
                      {isSheetExpanded ? '접기' : '열기'}
                    </span>

                    {/* Close button with stopPropagation */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSearchSheetOpen(false);
                      }}
                      className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-stone-400 transition-colors"
                      title="검색패널 완전히 닫기"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sheet content area (only visible/rendered when expanded) */}
              {isSheetExpanded && (
                <div 
                  className="p-5 flex flex-col gap-4.5 max-h-[50vh] md:max-h-[60vh] overflow-y-auto bg-white/95"
                  id="bottom-sheet-inner-scroll"
                >
                  {/* Search query input box */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Search className="w-3 h-3 text-[#599e52]" />
                      <span>원하는 키워드 검색</span>
                    </label>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        setIsSheetExpanded(false); // Sinks down on Enter key submit
                      }}
                      className="relative"
                    >
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="제목, 내용, 태그 검색... (Enter 입력 시 검색 완료)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-stone-50 border border-gray-200 text-gray-800 rounded-xl pl-8.5 pr-8.5 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition placeholder:text-gray-400 font-semibold"
                      />
                      {searchQuery && (
                        <button 
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                          title="검색어 초기화"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </form>
                  </div>

                  {/* Categories Row */}
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <FolderDot className="w-3 h-3 text-[#599e52]" />
                      <span>카테고리 분류 선택 ({Object.keys(categoriesMap).length})</span>
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(categoriesMap).map(([title, cnt]) => {
                        const isSelected = selectedCategory === title;
                        return (
                          <div
                            key={title}
                            onClick={() => {
                              setSelectedCategory(isSelected ? null : title);
                              setIsSheetExpanded(false); // 가라앉음
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected 
                                ? 'bg-emerald-50 border-[#599e52] [box-shadow:0_2px_8px_rgba(59,158,82,0.06)]' 
                                : 'bg-stone-50/50 hover:bg-stone-50 border-stone-200 hover:border-[#6ac05e]/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`p-1.5 rounded-lg text-white ${
                                (() => {
                                  const spec = categories.find(c => c.name === title);
                                  return spec ? spec.color : 'bg-purple-600';
                                })()
                              }`}>
                                <BookOpen className="w-3 h-3" />
                              </span>
                              <span className="text-xs font-bold text-gray-700">{title}</span>
                            </div>
                            
                            <span className={`${
                              isSelected ? 'bg-[#599e52] text-white' : 'bg-stone-200 text-stone-600'
                            } text-[9px] font-semibold px-2 py-0.5 rounded-full`}>
                              {cnt}
                            </span>
                          </div>
                        );
                      })}
                      {Object.keys(categoriesMap).length === 0 && (
                        <p className="text-stone-400 text-xs text-center py-2 col-span-2">생성된 카테고리가 존재하지 않습니다.</p>
                      )}
                    </div>
                  </div>

                  {/* Hash Tags row */}
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <TagIcon className="w-3 h-3 text-[#599e52]" />
                      <span>태그 조회 선택 ({Object.keys(tagsMap).length})</span>
                    </h4>

                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(tagsMap).map(([tag, val]) => {
                        const isSelected = selectedTag === tag;
                        return (
                          <button
                            key={tag}
                            onClick={() => {
                              setSelectedTag(isSelected ? null : tag);
                              setIsSheetExpanded(false); // 가라앉음
                            }}
                            className={`p-1 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all border ${
                              isSelected 
                                ? 'bg-[#599e52] border-[#599e52] text-white' 
                                : 'bg-stone-50 border-stone-200 text-gray-600 hover:border-[#599e52]'
                            }`}
                          >
                            <span>#{tag}</span>
                            <span className={`text-[9px] px-1 rounded-full ${
                              isSelected ? 'bg-white/30 text-white' : 'bg-green-100 text-[#599e52]'
                            }`}>
                              {val}
                            </span>
                          </button>
                        );
                      })}
                      {Object.keys(tagsMap).length === 0 && (
                        <p className="text-stone-400 text-xs py-2 w-full">사용된 일기 태그가 없습니다.</p>
                      )}
                    </div>
                  </div>

                  {/* Close / Settle action button */}
                  <div className="flex items-center justify-end border-t border-stone-100 pt-3">
                    <button
                      onClick={() => setIsSheetExpanded(false)}
                      className="px-4 py-2 bg-[#599e52] hover:bg-[#4ba843] text-white text-xs font-bold rounded-xl shadow-xs transition"
                    >
                      검색결과 확인 및 아래로 접기
                    </button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled uniform 5-button bottom navigation bar */}
      {activeTab !== 'write' && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 py-3.5 px-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] select-none">
          <div className="max-w-md mx-auto flex items-center justify-between">
            
            <button
              onClick={() => { 
                setActiveTab('feed'); 
                handleClearFilters(); 
                setIsSearchSheetOpen(false);
                setIsSheetExpanded(false);
              }}
              className={`flex items-center justify-center flex-1 py-1 rounded-xl transition ${
                activeTab === 'feed' && !isSearchSheetOpen ? 'text-[#599e52]' : 'text-gray-400 hover:text-gray-600'
              }`}
              id="nav-btn-feed"
              title="홈"
            >
              <Home className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                setActiveTab('calendar');
                setIsSearchSheetOpen(false);
                setIsSheetExpanded(false);
              }}
              className={`flex items-center justify-center flex-1 py-1 rounded-xl transition ${
                activeTab === 'calendar' ? 'text-[#599e52]' : 'text-gray-400 hover:text-gray-600'
              }`}
              id="nav-btn-calendar"
              title="달력"
            >
              <CalendarIcon className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                handleOpenWrite();
                setIsSearchSheetOpen(false);
                setIsSheetExpanded(false);
              }}
              className={`flex items-center justify-center flex-1 py-1 rounded-xl transition ${
                activeTab === 'write' ? 'text-[#599e52]' : 'text-gray-400 hover:text-gray-600'
              }`}
              id="nav-btn-write"
              title="쓰기"
            >
              <Pencil className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                setActiveTab('feed');
                if (!isSearchSheetOpen) {
                  setIsSearchSheetOpen(true);
                  setIsSheetExpanded(true);
                } else {
                  setIsSheetExpanded(prev => !prev);
                }
              }}
              className={`flex items-center justify-center flex-1 py-1 rounded-xl transition ${
                isSearchSheetOpen ? 'text-[#599e52]' : 'text-gray-400 hover:text-gray-600'
              }`}
              id="nav-btn-search"
              title="검색"
            >
              <Search className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                setActiveTab('save');
                setIsSearchSheetOpen(false);
                setIsSheetExpanded(false);
              }}
              className={`flex items-center justify-center flex-1 py-1 rounded-xl transition ${
                activeTab === 'save' ? 'text-[#599e52]' : 'text-gray-400 hover:text-gray-600'
              }`}
              id="nav-btn-save"
              title="저장"
            >
              <Download className="w-6 h-6" />
            </button>

          </div>
        </footer>
      )}

      {/* Float Toasts notifier */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed ${activeTab === 'write' ? 'bottom-6' : 'bottom-24'} left-1/2 -translate-x-1/2 p-3.5 px-5 rounded-2xl z-50 shadow-lg text-sm text-white font-semibold flex items-center gap-2 max-w-sm w-[90%] ${
              toastType === 'success' ? 'bg-[#599e52]' :
              toastType === 'info' ? 'bg-indigo-600' : 'bg-rose-500'
            }`}
            id="toast-notification-banner"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discard Writing Confirm Modal Overlay */}
      <AnimatePresence>
        {showDiscardConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
            id="discard-confirm-modal-overlay"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-sm p-6 text-left flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
                  <AlertTriangle className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">작성 취소 확인</h3>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                    작성 중인 내용이 저장되지 않았습니다. 작성을 취소하고 홈화면으로 돌아가시겠습니까?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirmModal(false);
                    setActiveTab('feed');
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-100 active:bg-rose-200 text-rose-700 text-xs font-black rounded-xl text-center transition cursor-pointer"
                  id="confirm-discard-btn"
                >
                  기록 취소 (홈으로)
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirmModal(false)}
                  className="flex-1 py-2.5 px-4 bg-[#599e52] hover:bg-[#4ba843] active:bg-[#3f9038] text-white text-xs font-black rounded-xl text-center shadow-xs transition cursor-pointer"
                  id="cancel-discard-btn"
                >
                  일기 계속 쓰기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
