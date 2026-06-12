/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Plus, ArrowLeftRight, Clock, FileDown, Trash2 } from 'lucide-react';
import { DiaryEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { highlightHTML } from '../utils/highlighter';

interface CalendarViewProps {
  entries: DiaryEntry[];
  onSelectEntry: (entry: DiaryEntry) => void;
  onWriteForDate: (dateString: string) => void;
  onDeleteEntry?: (id: number) => void;
  onDownloadSingleEntryAndGroup?: (date: string, category: string) => void;
  searchQuery?: string;
}

export default function CalendarView({ 
  entries, 
  onSelectEntry, 
  onWriteForDate, 
  onDeleteEntry, 
  onDownloadSingleEntryAndGroup,
  searchQuery = ''
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [expandedEntries, setExpandedEntries] = useState<Record<number, boolean>>({});

  // Reset expanded entries on month, selected day, or search changes
  useEffect(() => {
    setExpandedEntries({});
  }, [currentDate, selectedDateStr, searchQuery]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Format date helper: Date -> YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number): string => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  // Let's standardise so Monday is the first column as shown in Attachment 2 (월 화 수 목 금 토 일)
  const firstDayIndexRaw = new Date(year, month, 1).getDay();
  // Map Sun (0) -> 6, Mon (1) -> 0, Tue (2) -> 1, ..., Sat (6) -> 5
  const firstDayIndex = firstDayIndexRaw === 0 ? 6 : firstDayIndexRaw - 1;

  // Previous month padding days
  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Get days layout grid
  const daysGrid: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Add previous month's padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    daysGrid.push({
      dayNum: d,
      dateStr: formatDateString(prevYear, prevMonth, d),
      isCurrentMonth: false,
    });
  }

  // Add current month days
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push({
      dayNum: d,
      dateStr: formatDateString(year, month, d),
      isCurrentMonth: true,
    });
  }

  // Add next month padding days to complete grid (usually 42 cells or multiples of 7)
  const remainingCells = 42 - daysGrid.length;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    daysGrid.push({
      dayNum: d,
      dateStr: formatDateString(nextYear, nextMonth, d),
      isCurrentMonth: false,
    });
  }

  // Safe checks for diary entries on specific dates
  const getEntriesForDate = (dateStr: string) => {
    return entries.filter(e => e.date === dateStr);
  };

  // Selected date's diary lists
  const selectedEntries = getEntriesForDate(selectedDateStr);

  // UI rendering of Weekdays (mon-sun)
  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="flex flex-col gap-4" id="calendar-view-container">
      {/* Calendar Grid card: smaller padding for compact sizing */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-xs">
        {/* Calendar Navigation header: minimized margins */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 px-1.5 rounded-lg border border-[#cbd5e1] hover:bg-gray-50 text-gray-600 transition cursor-pointer active:scale-95"
              title="이전 달"
              id="btn-calendar-prev"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[#cbd5e1] hover:bg-gray-50 text-gray-700 transition cursor-pointer active:scale-95"
              id="btn-calendar-today"
            >
              오늘
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 px-1.5 rounded-lg border border-[#cbd5e1] hover:bg-gray-50 text-gray-600 transition cursor-pointer active:scale-95"
              title="다음 달"
              id="btn-calendar-next"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <h2 className="text-base font-black text-[#7c3aed] flex items-center gap-1 font-mono">
            <span>{year}년 {month + 1}월</span>
          </h2>
          <div className="text-[11px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
            전체: {entries.length}개
          </div>
        </div>

        {/* Days of Week header: tightened vertical spacing */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-extrabold text-gray-500 mb-1.5 border-b border-[#f1f5f9] pb-1.5">
          {weekdays.map((day, ix) => (
            <div 
              key={day} 
              className={`py-0.5 ${ix === 5 ? 'text-[#3b82f6]' : ix === 6 ? 'text-[#f43f5e]' : ''}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days grid: more compact line height with h-8 / md:h-9 in cells instead of raw aspect ratios */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-1" id="calendar-days-grid">
          {daysGrid.map(({ dayNum, dateStr, isCurrentMonth }, idx) => {
            const dayEntries = getEntriesForDate(dateStr);
            const hasDiary = dayEntries.length > 0;
            const isSelected = selectedDateStr === dateStr;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            // Base text colors
            let textColor = isCurrentMonth ? 'text-gray-800' : 'text-gray-300';
            const colIndex = idx % 7;
            if (isCurrentMonth) {
              if (colIndex === 5) textColor = 'text-[#3b82f6]'; // Saturday
              if (colIndex === 6) textColor = 'text-[#f43f5e]'; // Sunday
            }

            // Decide compact background class and coloring of the wrapping envelope
            let cellBgClass = 'hover:bg-gray-50';
            let finalTextColor = textColor;

            if (isSelected) {
              // Selected state (deep violet selection color)
              cellBgClass = 'bg-[#7c3aed] text-white shadow-xs scale-102 z-10';
              // If selected has diary as well, let's decorate with a double ring of green
              if (hasDiary) {
                cellBgClass += ' ring-2 ring-[#599e52] ring-offset-1';
              }
              finalTextColor = 'text-white';
            } else if (hasDiary) {
              // User has a diary: wrap with soft green envelope padding (일기가 주어지면 초록색 둘러싸기)
              cellBgClass = 'bg-[#599e52]/11 border border-[#599e52]/25 text-[#306e2a] font-extrabold';
              finalTextColor = 'text-[#306e2a]';
            } else if (isToday) {
              // Standard today state (soft gray/purple theme)
              cellBgClass = 'bg-[#f5eeff] border border-[#d8b4fe]';
              if (isCurrentMonth) {
                finalTextColor = 'text-[#7c3aed] font-extrabold';
              }
            }

            return (
              <button
                key={`${dateStr}-${idx}`}
                onClick={() => setSelectedDateStr(dateStr)}
                className={`relative h-8 md:h-9 rounded-xl flex flex-col items-center justify-center p-0.5 focus:outline-none transition-all group cursor-pointer ${cellBgClass}`}
                id={`calendar-cell-${dateStr}`}
              >
                {/* Day label */}
                <span className={`text-xs font-bold transition-colors ${
                  isSelected ? 'text-white' : finalTextColor
                }`}>
                  {dayNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day's Diaries container */}
      <div className="flex flex-col gap-4" id="calendar-selected-entries">
        <div className="flex items-center justify-between border-b border-[#ebd9fc] pb-2">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span>{selectedDateStr.replace(/-/g, '.')} 작성된 일기 ({selectedEntries.length})</span>
          </h3>
          <button
            onClick={() => onWriteForDate(selectedDateStr)}
            className="flex items-center gap-1 px-3 py-1 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg transition"
            id="btn-calendar-add-diary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>이 날짜에 쓰기</span>
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {selectedEntries.length > 0 ? (
            <div className="flex flex-col gap-4">
              {selectedEntries.map((entry) => {
                const dateParts = entry.date.split('-');
                const yearNum = dateParts[0];
                const monthNum = parseInt(dateParts[1], 10);
                const dayNum = parseInt(dateParts[2], 10);
                
                // Get week of day
                const dObj = new Date(entry.date);
                const weekStr = ['일', '월', '화', '수', '목', '금', '토'][dObj.getDay()];

                return (
                  <motion.div
                    layout
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex bg-white rounded-3xl border border-[#e2e8f0] [box-shadow:0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden transition-all hover:border-[#6ac05e]/50 hover:[box-shadow:0_8px_24px_rgba(0,0,0,0.05)] text-left"
                    id={`calendar-entry-card-${entry.id}`}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                  >
                    {/* Left Date indicator */}
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

                    {/* Right text and actions header */}
                    <motion.div layout="position" className="flex-1 p-2.5 flex flex-col justify-between">
                      <div>
                        {/* Meta row with Category Badge instead of Date */}
                        <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                          <span className="flex items-center gap-1 bg-gray-50 p-1 px-2.5 rounded-full border border-gray-100">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{entry.time}</span>
                          </span>
                          {entry.category && (
                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold text-white rounded-lg select-none uppercase tracking-wide shadow-xs ${
                              entry.category === '독서록' ? 'bg-emerald-600' :
                              entry.category === '업무 기록' ? 'bg-amber-500' :
                              entry.category === '일상' || entry.category === '일반 일기' ? 'bg-[#599e52]' : 'bg-[#7c3aed]'
                            }`}>
                              {entry.category === '일반 일기' ? '일상' : entry.category}
                            </span>
                          )}
                        </div>

                        {/* Body contents */}
                        {(() => {
                          const cleanText = entry.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                          const isLong = cleanText.length > 140;
                          const isExpanded = expandedEntries[entry.id];

                          if (isLong) {
                            return (
                                  <div className="text-base md:text-lg text-gray-700 leading-relaxed max-w-none prose prose-p:my-0.5 mb-1.5 select-text text-left overflow-hidden">
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
                              className="text-base md:text-lg text-gray-700 leading-relaxed max-w-none prose prose-p:my-0.5 mb-1.5 select-text text-left"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(entry.content, searchQuery) }}
                            />
                          );
                        })()}
                      </div>

                      {/* Footer tags & action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f8fafc] pt-1.5">
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {entry.tags && entry.tags.length > 0 ? (
                            entry.tags.map(tag => (
                              <span 
                                key={tag} 
                                className="text-[11px] font-bold text-[#599e52] bg-[#f0f9f0] px-2 py-1 rounded-full text-left"
                              >
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">태그 없음</span>
                          )}
                        </div>

                        {/* Inline operations */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {onDownloadSingleEntryAndGroup && (
                            <button
                              onClick={() => onDownloadSingleEntryAndGroup(entry.date, entry.category)}
                              className="p-1 px-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 text-gray-500 hover:text-emerald-700 transition cursor-pointer"
                              title="이 일기만 마크다운 파일로 다운로드하기"
                              id={`calendar-btn-dl-entry-${entry.id}`}
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onSelectEntry(entry)}
                            className="p-1.5 text-[#599e52] bg-emerald-50 hover:bg-[#599e52]/10 rounded-lg transition cursor-pointer"
                            title="수정"
                            id={`calendar-btn-edit-entry-${entry.id}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteEntry && (
                            <button
                              onClick={() => onDeleteEntry(entry.id!)}
                              className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                              title="삭제"
                              id={`calendar-btn-delete-entry-${entry.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-stone-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-500"
              id="calendar-no-entries"
            >
              <p className="text-sm mb-3">설정된 날짜({selectedDateStr})에 적힌 일기가 없습니다.</p>
              <button
                onClick={() => onWriteForDate(selectedDateStr)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-xl shadow-sm transition"
                id="btn-calendar-quick-write"
              >
                <Plus className="w-4 h-4" />
                <span>새 마크다운 일기 쓰기</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
