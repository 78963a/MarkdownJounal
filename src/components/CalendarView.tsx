import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit3, Plus, ArrowLeftRight, Clock, FileDown, Trash2 } from 'lucide-react';
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
  const [localCategory, setLocalCategory] = useState<string | null>(null);

  // Reset expanded entries on month, selected day, or search changes
  useEffect(() => {
    setExpandedEntries({});
  }, [currentDate, selectedDateStr, searchQuery]);

  // Reset local category when selected date changes
  useEffect(() => {
    setLocalCategory(null);
  }, [selectedDateStr]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // State elements for Direct Date Search & Picker Wheel Modal
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [wheelYear, setWheelYear] = useState(() => year);
  const [wheelMonth, setWheelMonth] = useState(() => month + 1);
  const [wheelDay, setWheelDay] = useState(() => {
    const parts = selectedDateStr.split('-');
    return parts.length >= 3 ? parseInt(parts[2], 10) : 1;
  });

  const [typedYear, setTypedYear] = useState('');
  const [typedMonth, setTypedMonth] = useState('');
  const [typedDay, setTypedDay] = useState('');
  const [typeErrorMsg, setTypeErrorMsg] = useState('');

  const yearInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);

  // Auto-sync picker states with selected date changes
  useEffect(() => {
    if (selectedDateStr) {
      const parts = selectedDateStr.split('-');
      if (parts.length >= 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y)) {
          setWheelYear(y);
          setTypedYear(parts[0]);
        }
        if (!isNaN(m)) {
          setWheelMonth(m);
          setTypedMonth(parts[1]);
        }
        if (!isNaN(d)) {
          setWheelDay(d);
          setTypedDay(parts[2]);
        }
      }
    }
  }, [selectedDateStr]);

  // Synchronize manual text date from scroll selection inputs
  const syncManualText = (y: number, m: number, d: number) => {
    setTypedYear(String(y));
    setTypedMonth(String(m).padStart(2, '0'));
    setTypedDay(String(d).padStart(2, '0'));
    setTypeErrorMsg('');
  };

  const validateAndSyncFromInputs = (yStr: string, mStr: string, dStr: string) => {
    const completeY = yStr.trim();
    const completeM = mStr.trim();
    const completeD = dStr.trim();

    if (completeY.length < 4 || completeM.length < 1 || completeD.length < 1) {
      setTypeErrorMsg('연도는 4자리, 월과 일은 숫자로 입력해주세요.');
      return;
    }

    const y = parseInt(completeY, 10);
    const m = parseInt(completeM, 10);
    const d = parseInt(completeD, 10);

    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      setTypeErrorMsg('숫자 형식으로 올바르게 입력해주세요.');
      return;
    }
    
    if (m < 1 || m > 12) {
      setTypeErrorMsg('올바르지 않은 월입니다 (1-12)');
      return;
    }
    const maxD = new Date(y, m, 0).getDate();
    if (d < 1 || d > maxD) {
      setTypeErrorMsg(`해당 월은 1일부터 ${maxD}일까지 있습니다.`);
      return;
    }

    // Is valid! Sync with scrolling wheels
    setWheelYear(y);
    setWheelMonth(m);
    setWheelDay(d);
    setTypeErrorMsg('');
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
    setTypedYear(clean);
    validateAndSyncFromInputs(clean, typedMonth, typedDay);
    if (clean.length === 4) {
      monthInputRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 2);
    setTypedMonth(clean);
    validateAndSyncFromInputs(typedYear, clean, typedDay);
    if (clean.length === 2) {
      dayInputRef.current?.focus();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 2);
    setTypedDay(clean);
    validateAndSyncFromInputs(typedYear, typedMonth, clean);
  };

  const handleMonthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && typedMonth === '') {
      yearInputRef.current?.focus();
    }
  };

  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && typedDay === '') {
      monthInputRef.current?.focus();
    }
  };

  // Extract years with diary entries to filter select fields
  const existingYears = (() => {
    const currentYearStr = new Date().getFullYear();
    const uniqueYears = Array.from(new Set(entries.map(e => {
      const y = parseInt(e.date.split('-')[0], 10);
      return isNaN(y) ? null : y;
    }).filter((y): y is number => y !== null)));
    
    if (uniqueYears.length === 0) {
      uniqueYears.push(currentYearStr);
    }
    return uniqueYears.sort((a, b) => a - b);
  })();

  const hasPrevYear = existingYears.some(y => y < year);
  const hasNextYear = existingYears.some(y => y > year);

  const handlePrevYear = () => {
    if (hasPrevYear) {
      setCurrentDate(new Date(year - 1, month, 1));
    }
  };

  const handleNextYear = () => {
    if (hasNextYear) {
      setCurrentDate(new Date(year + 1, month, 1));
    }
  };

  // Count the saved entries for the newly scrolled/picked Year + Month instantly
  const countForSelectedMonth = entries.filter(e => {
    const parts = e.date.split('-');
    if (parts.length >= 2) {
      const entryY = parseInt(parts[0], 10);
      const entryM = parseInt(parts[1], 10);
      return entryY === wheelYear && entryM === wheelMonth;
    }
    return false;
  }).length;

  const handleConfirmDateSelection = () => {
    const yStr = typedYear.trim();
    const mStr = typedMonth.trim().padStart(2, '0');
    const dStr = typedDay.trim().padStart(2, '0');

    if (yStr.length !== 4) {
      setTypeErrorMsg('올바른 4자리 연도를 입력해주세요.');
      return;
    }
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);

    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      setTypeErrorMsg('숫자로 올바른 날짜를 입력해주세요.');
      return;
    }

    if (m < 1 || m > 12) {
      setTypeErrorMsg('올바르지 않은 월입니다 (1-12)');
      return;
    }
    const maxD = new Date(y, m, 0).getDate();
    if (d < 1 || d > maxD) {
      setTypeErrorMsg(`해당 월은 1일부터 ${maxD}일까지 있습니다.`);
      return;
    }

    setCurrentDate(new Date(y, m - 1, 1));
    setSelectedDateStr(`${y}-${mStr}-${dStr}`);
    setIsPickerModalOpen(false);
  };

  // Format date helper: Date -> YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number): string => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
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

  // Determine whether Day View is active or Month View is active
  const getSelectedParsed = () => {
    if (!selectedDateStr) return { selYear: 0, selMonth: 0, selDay: 0 };
    const parts = selectedDateStr.split('-');
    if (parts.length < 3) return { selYear: 0, selMonth: 0, selDay: 0 };
    return {
      selYear: parseInt(parts[0], 10),
      selMonth: parseInt(parts[1], 10),
      selDay: parseInt(parts[2], 10)
    };
  };

  const { selYear, selMonth, selDay } = getSelectedParsed();
  const isDayViewActive = selYear === year && selMonth === (month + 1);

  // Day View Entries (filtered by category if selected)
  const rawDayEntries = entries.filter(e => e.date === selectedDateStr);
  const filteredDayEntries = localCategory
    ? rawDayEntries.filter(e => {
        const cat = e.category === '일반 일기' ? '일상' : e.category;
        return cat === localCategory;
      })
    : rawDayEntries;

  // Month View Entries (filtered by current year and month, and then by category if selected)
  const rawMonthEntries = entries.filter(e => {
    const parts = e.date.split('-');
    if (parts.length >= 2) {
      const entryY = parseInt(parts[0], 10);
      const entryM = parseInt(parts[1], 10);
      return entryY === year && entryM === (month + 1);
    }
    return false;
  });

  // Sort monthly entries by date descending, then time descending
  const sortedMonthEntries = [...rawMonthEntries].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return (b.time || '').localeCompare(a.time || '');
  });

  const filteredMonthEntries = localCategory
    ? sortedMonthEntries.filter(e => {
        const cat = e.category === '일반 일기' ? '일상' : e.category;
        return cat === localCategory;
      })
    : sortedMonthEntries;

  const activeEntries = isDayViewActive ? filteredDayEntries : filteredMonthEntries;

  // UI rendering of Weekdays (mon-sun)
  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="flex flex-col gap-4" id="calendar-view-container">
      {/* Calendar Grid card: smaller padding for compact sizing */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-xs">
        {/* Calendar Navigation header: minimized margins */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex gap-1">
            {/* 지난해 (Previous Year) */}
            <button
              onClick={handlePrevYear}
              disabled={!hasPrevYear}
              className={`p-1 px-1.5 rounded-lg border transition ${
                hasPrevYear 
                  ? 'border-[#cbd5e1] hover:bg-gray-50 text-gray-600 cursor-pointer active:scale-95' 
                  : 'border-stone-100 text-stone-300 cursor-not-allowed bg-stone-50/50'
              }`}
              title="지난해 (이전 해)"
              id="btn-calendar-prev-year"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* 지난달 (Previous Month) */}
            <button
              onClick={handlePrevMonth}
              className="p-1 px-1.5 rounded-lg border border-[#cbd5e1] hover:bg-gray-50 text-gray-600 transition cursor-pointer active:scale-95"
              title="이전 달"
              id="btn-calendar-prev"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* 오늘 */}
            <button
              onClick={handleToday}
              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[#cbd5e1] hover:bg-gray-50 text-gray-700 transition cursor-pointer active:scale-95"
              id="btn-calendar-today"
            >
              오늘
            </button>

            {/* 다음달 (Next Month) */}
            <button
              onClick={handleNextMonth}
              className="p-1 px-1.5 rounded-lg border border-[#cbd5e1] hover:bg-gray-50 text-gray-600 transition cursor-pointer active:scale-95"
              title="다음 달"
              id="btn-calendar-next"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* 다음해 (Next Year) */}
            <button
              onClick={handleNextYear}
              disabled={!hasNextYear}
              className={`p-1 px-1.5 rounded-lg border transition ${
                hasNextYear 
                  ? 'border-[#cbd5e1] hover:bg-gray-50 text-gray-600 cursor-pointer active:scale-95' 
                  : 'border-stone-100 text-stone-300 cursor-not-allowed bg-stone-50/50'
              }`}
              title="다음해 (다음 해)"
              id="btn-calendar-next-year"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Month Picker Trigger Title */}
          <h2 className="text-base font-black text-[#7c3aed] font-mono">
            <button
              onClick={() => {
                setIsPickerModalOpen(true);
                // Pre-populate scrollwheel states with the current calendar view's date
                setWheelYear(year);
                setWheelMonth(month + 1);
                const parts = selectedDateStr.split('-');
                if (parts.length >= 3 && parseInt(parts[0], 10) === year && parseInt(parts[1], 10) === (month + 1)) {
                  setWheelDay(parseInt(parts[2], 10));
                } else {
                  setWheelDay(1);
                }
                syncManualText(year, month + 1, wheelDay);
              }}
              className="px-2.5 py-1 hover:bg-purple-50 active:scale-95 rounded-xl border border-transparent hover:border-purple-200 transition-all cursor-pointer flex items-center gap-1"
              title="연/월/일 직접 선택 및 이동 모달 열기"
              id="btn-calendar-header-picker"
            >
              <span>{year}년 {month + 1}월</span>
              <span className="text-[10px] text-purple-400 font-extrabold select-none">▼</span>
            </button>
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
                onClick={() => {
                  setSelectedDateStr(dateStr);
                  const parts = dateStr.split('-');
                  if (parts.length >= 2) {
                    const cellYear = parseInt(parts[0], 10);
                    const cellMonth = parseInt(parts[1], 10);
                    setCurrentDate(new Date(cellYear, cellMonth - 1, 1));
                  }
                }}
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
          <h3 className="text-sm font-bold text-gray-700 flex flex-wrap items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span className="flex flex-wrap items-center gap-1.5">
              {isDayViewActive ? (
                <span>{selYear}.{selMonth}.{selDay}. 일기 ({activeEntries.length})</span>
              ) : (
                <span>{year}.{month + 1}. 일기 ({activeEntries.length})</span>
              )}
              {localCategory && (
                <span 
                  onClick={() => setLocalCategory(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-[#7c3aed] border border-purple-200 text-xs rounded-full font-bold cursor-pointer transition"
                  title="카테고리 필터 해제"
                >
                  <span>{localCategory}</span>
                  <span className="text-[10px] font-black text-[#7c3aed]/70">×</span>
                </span>
              )}
            </span>
          </h3>
          {isDayViewActive && (
            <button
              onClick={() => onWriteForDate(selectedDateStr)}
              className="flex items-center gap-1 px-3 py-1 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg transition"
              id="btn-calendar-add-diary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>이 날짜에 쓰기</span>
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {activeEntries.length > 0 ? (
            <div className="flex flex-col gap-4">
              {activeEntries.map((entry) => {
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
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                const catName = entry.category === '일반 일기' ? '일상' : entry.category;
                                if (localCategory === catName) {
                                  setLocalCategory(null);
                                } else {
                                  setLocalCategory(catName);
                                }
                              }}
                              className={`px-2.5 py-0.5 text-[10px] font-extrabold text-white rounded-lg select-none uppercase tracking-wide shadow-xs cursor-pointer active:scale-95 hover:brightness-95 transition-all ${
                                entry.category === '독서록' ? 'bg-emerald-600' :
                                entry.category === '업무 기록' ? 'bg-amber-500' :
                                entry.category === '일상' || entry.category === '일반 일기' ? 'bg-[#599e52]' : 'bg-[#7c3aed]'
                              }`}
                              title={`${entry.category === '일반 일기' ? '일상' : entry.category} 카테고리 필터링`}
                            >
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
                                             className="text-[#7c3aed] font-extrabold hover:text-[#5b21b6] transition cursor-pointer inline-flex items-center gap-1 select-none text-sm ml-1.5 hover:underline bg-transparent border-none p-0 outline-none"
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
                                               className="text-[#7c3aed] font-extrabold hover:text-[#5b21b6] transition cursor-pointer inline-flex items-center gap-1 select-none text-xs hover:underline bg-transparent border-none p-0 outline-none"
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
              {isDayViewActive ? (
                <>
                  <p className="text-sm mb-3">해당 날짜({selYear}.{selMonth}.{selDay}.)에 일기가 없습니다.</p>
                  <button
                    onClick={() => onWriteForDate(selectedDateStr)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
                    id="btn-calendar-quick-write"
                  >
                    <Plus className="w-4 h-4" />
                    <span>새 일기 쓰기</span>
                  </button>
                </>
              ) : (
                <p className="text-sm">해당 연월({year}.{month + 1}.)에 일기가 없습니다.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Direct Date Search & Picker Wheel Modal */}
      <AnimatePresence>
        {isPickerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 backdrop-blur-xs">
            <div 
              className="bg-white rounded-2xl border-2 border-[#7c3aed] p-4 w-full max-w-[280px] shadow-2xl flex flex-col gap-3 text-left animate-in fade-in duration-150"
              id="calendar-picker-modal"
            >
              {/* Header: Compact close button, no text */}
              <div className="flex items-center justify-end border-b border-stone-200 pb-1.5">
                <button
                  type="button"
                  onClick={() => setIsPickerModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 text-sm font-black p-0.5 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scroll Wheel Style Selection Container: Prominent borders with simplified layouts */}
              <div className="flex flex-col gap-1.5 bg-stone-50 border-2 border-stone-300 rounded-xl p-2.5 shadow-2xs">
                <div className="grid grid-cols-3 gap-1">
                  {/* Year Column */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-extrabold text-stone-500 mb-0.5 select-none font-mono">연도</span>
                    <div className="h-28 overflow-y-auto w-full flex flex-col gap-0.5 px-0.5 scrollbar-thin">
                      {existingYears.map(y => {
                        const isVal = y === wheelYear;
                        return (
                          <button
                            key={y}
                            type="button"
                            onClick={() => {
                              setWheelYear(y);
                              syncManualText(y, wheelMonth, wheelDay);
                            }}
                            className={`py-0.5 text-xs font-mono font-black rounded-md transition-all cursor-pointer ${
                              isVal 
                                ? 'bg-[#7c3aed] text-white shadow-xs font-extrabold' 
                                : 'text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {y}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Month Column */}
                  <div className="flex flex-col items-center border-l-2 border-stone-300">
                    <span className="text-[10px] font-extrabold text-stone-500 mb-0.5 select-none font-mono">월</span>
                    <div className="h-28 overflow-y-auto w-full flex flex-col gap-0.5 px-0.5 scrollbar-thin">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const isVal = m === wheelMonth;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setWheelMonth(m);
                              syncManualText(wheelYear, m, wheelDay);
                            }}
                            className={`py-0.5 text-xs font-mono font-black rounded-md transition-all cursor-pointer ${
                              isVal 
                                ? 'bg-[#7c3aed] text-white shadow-xs font-extrabold' 
                                : 'text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Day Column */}
                  <div className="flex flex-col items-center border-l-2 border-stone-300">
                    <span className="text-[10px] font-extrabold text-stone-500 mb-0.5 select-none font-mono">일</span>
                    <div className="h-28 overflow-y-auto w-full flex flex-col gap-0.5 px-0.5 scrollbar-thin">
                      {(() => {
                        const maxD = new Date(wheelYear, wheelMonth, 0).getDate();
                        const daysArr = Array.from({ length: maxD }, (_, i) => i + 1);
                        return daysArr.map(d => {
                          const isVal = d === wheelDay;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setWheelDay(d);
                                syncManualText(wheelYear, wheelMonth, d);
                              }}
                              className={`py-0.5 text-xs font-mono font-black rounded-md transition-all cursor-pointer ${
                                isVal 
                                  ? 'bg-[#7c3aed] text-white shadow-xs font-extrabold' 
                                  : 'text-stone-700 hover:bg-stone-200'
                              }`}
                            >
                              {d}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Live entry count info */}
                <div className="mt-1.5 text-center border-t-2 border-stone-300 pt-1.5">
                  <p className="text-[11px] font-bold text-stone-600">
                    이 달에는 <span className="text-xs font-black text-[#599e52]">{countForSelectedMonth}개</span>의 기록이 있습니다.
                  </p>
                </div>
              </div>

              {/* Split numeric inputs direct entry */}
              <div className="flex flex-col gap-1 mx-auto w-full">
                <div className="flex items-center justify-center gap-1">
                  <input
                    ref={yearInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={typedYear}
                    onChange={handleYearChange}
                    placeholder="YYYY"
                    className="w-16 bg-white border-2 border-stone-400 rounded-lg px-1.5 py-1 text-sm font-mono font-bold text-center outline-none focus:ring-1 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                    id="type-input-year"
                  />
                  <span className="text-stone-600 font-extrabold font-mono select-none">-</span>
                  <input
                    ref={monthInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={typedMonth}
                    onKeyDown={handleMonthKeyDown}
                    onChange={handleMonthChange}
                    placeholder="MM"
                    className="w-11 bg-white border-2 border-stone-400 rounded-lg px-1.5 py-1 text-sm font-mono font-bold text-center outline-none focus:ring-1 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                    id="type-input-month"
                  />
                  <span className="text-stone-600 font-extrabold font-mono select-none">-</span>
                  <input
                    ref={dayInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={typedDay}
                    onKeyDown={handleDayKeyDown}
                    onChange={handleDayChange}
                    placeholder="DD"
                    className="w-11 bg-white border-2 border-stone-400 rounded-lg px-1.5 py-1 text-sm font-mono font-bold text-center outline-none focus:ring-1 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                    id="type-input-day"
                  />
                </div>

                {/* Statically reserved space for typeErrorMsg to prevent modal size jitter */}
                <div className="h-5 flex items-center justify-center">
                  {typeErrorMsg ? (
                    <p className="text-[10px] text-rose-500 font-bold text-center leading-tight">
                      {typeErrorMsg}
                    </p>
                  ) : (
                    <p className="text-[10px] text-transparent select-none text-center">
                      &nbsp;
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPickerModalOpen(false)}
                  className="flex-1 py-1.5 border-2 border-stone-400 hover:bg-stone-100 text-stone-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDateSelection}
                  className="flex-1 py-1.5 bg-[#7c3aed] border-2 border-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
                >
                  이동하기
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
