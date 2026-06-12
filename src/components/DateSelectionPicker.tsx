import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface DateSelectionPickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (val: string) => void;
  onClose: () => void;
}

export default function DateSelectionPicker({ value, onChange, onClose }: DateSelectionPickerProps) {
  // Validate if date matches YYYY-MM-DD
  const isValidDateString = (dateStr: string) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Selected date state
  const [selectedDate, setSelectedDate] = useState(value || todayStr);
  // Manual input state
  const [manualInput, setManualInput] = useState(value || todayStr);

  // View state for calendar pagination
  const [viewYear, setViewYear] = useState(() => {
    const d = value && isValidDateString(value) ? new Date(value) : new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value && isValidDateString(value) ? new Date(value) : new Date();
    return d.getMonth(); // 0-indexed
  });

  // Synchronize internal selection from props
  useEffect(() => {
    if (value && isValidDateString(value)) {
      setSelectedDate(value);
      setManualInput(value);
      const parsed = new Date(value);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]);

  // Synchronize calendar view if manual input gets fully written and valid
  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setManualInput(text);

    if (isValidDateString(text)) {
      setSelectedDate(text);
      const parsed = new Date(text);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  };

  // Select a cell date
  const handleSelectCell = (dateStr: string) => {
    setSelectedDate(dateStr);
    setManualInput(dateStr);
  };

  // Quick select today
  const handleSelectToday = () => {
    setSelectedDate(todayStr);
    setManualInput(todayStr);
    const parsed = new Date(todayStr);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  };

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Calendar cells calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0: Sun, 1: Mon, ...

  const daysGrid: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    const pmStr = String(pm + 1).padStart(2, '0');
    const pdStr = String(d).padStart(2, '0');
    daysGrid.push({
      dayNum: d,
      dateStr: `${py}-${pmStr}-${pdStr}`,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    daysGrid.push({
      dayNum: d,
      dateStr: `${viewYear}-${mStr}-${dStr}`,
      isCurrentMonth: true
    });
  }

  // Next month padding to fill standard 42-cell square (6 rows * 7 columns)
  const remainingCount = 42 - daysGrid.length;
  for (let d = 1; d <= remainingCount; d++) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nmStr = String(nm + 1).padStart(2, '0');
    const ndStr = String(d).padStart(2, '0');
    daysGrid.push({
      dayNum: d,
      dateStr: `${ny}-${nmStr}-${ndStr}`,
      isCurrentMonth: false
    });
  }

  const handleApply = () => {
    if (isValidDateString(selectedDate)) {
      onChange(selectedDate);
      onClose();
    }
  };

  // Convert "YYYY-MM-DD" to human friendly format: "2026년 6월 2일 화요일"
  const formatHeaderDate = (dateStr: string) => {
    try {
      if (!isValidDateString(dateStr)) return '날짜가 선택되지 않음';
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
      const date = new Date(dateStr);
      const dayName = days[date.getDay()];
      return `${year}년 ${month}월 ${day}일 ${dayName}`;
    } catch {
      return dateStr;
    }
  };

  // Formatter for today's dynamic quick button label like "오늘(6월 11일)"
  const getTodayButtonLabel = () => {
    try {
      const today = new Date();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      return `오늘(${m}월 ${d}일)`;
    } catch {
      return '오늘';
    }
  };

  return (
    <div 
      className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-sm p-5 text-left flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
      id="date-selection-picker-modal"
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between" id="date-picker-toolbar">
        {/* Left Side: Check Confirm Button (Green background, rounded) */}
        <button
          type="button"
          onClick={handleApply}
          disabled={!isValidDateString(selectedDate)}
          className={`p-2.5 rounded-full shadow-xs transition cursor-pointer active:scale-95 ${
            isValidDateString(selectedDate)
              ? 'bg-[#599e52] hover:bg-[#4ba843] text-white'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
          id="btn-apply-date-top"
          title="날짜 선택 완료"
        >
          <Check className="w-4 h-4 stroke-[3px]" />
        </button>

        {/* Center: Selected date formatted dynamically, no frames, no borders */}
        <div className="flex-1 text-center" id="date-picker-header-title">
          <span className="text-stone-800 text-sm font-extrabold tracking-tight">
            {formatHeaderDate(selectedDate)}
          </span>
        </div>

        {/* Right Side: Simple Cancel Button (No background) */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition duration-150 cursor-pointer active:scale-95"
          id="btn-close-date-top"
          title="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Interactive Main Calendar */}
      <div 
        className="bg-stone-50/70 border border-stone-150 rounded-2xl p-3 flex flex-col gap-2.5" 
        id="date-picker-interactive-calendar"
      >
        {/* Month Switching Row */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-black text-stone-800 font-mono">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-stone-150 rounded-lg text-stone-500 hover:text-stone-800 transition active:scale-90 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-stone-150 rounded-lg text-stone-500 hover:text-stone-800 transition active:scale-90 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Week Day Titles Panel */}
        <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-stone-400 pb-1 border-b border-stone-100">
          <span className="text-rose-500/85">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-blue-500/85">토</span>
        </div>

        {/* Days Dynamic Matrix Grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysGrid.map((cell, idx) => {
            const isSelected = selectedDate === cell.dateStr;
            const isTodayCell = todayStr === cell.dateStr;
            
            const dayOfWeek = idx % 7;
            let textClassName = 'text-stone-700';
            if (!cell.isCurrentMonth) {
              textClassName = 'text-stone-300';
            } else if (dayOfWeek === 0) {
              textClassName = 'text-rose-500 font-medium';
            } else if (dayOfWeek === 6) {
              textClassName = 'text-blue-500 font-medium';
            }

            return (
              <button
                key={`${cell.dateStr}-${idx}`}
                type="button"
                onClick={() => handleSelectCell(cell.dateStr)}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition mx-auto cursor-pointer active:scale-90 ${
                  isSelected
                    ? 'bg-[#599e52] text-white shadow-sm font-black scale-105 z-10'
                    : isTodayCell
                      ? 'bg-emerald-100/60 border border-emerald-200 text-emerald-800 font-black'
                      : 'hover:bg-stone-200/75'
                }`}
              >
                <span className={isSelected ? 'text-white' : textClassName}>{cell.dayNum}</span>
                {isTodayCell && !isSelected && (
                  <span className="absolute bottom-1 w-1-h-1 w-1 h-1 bg-[#599e52] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom Row: Left side direct text input, Right side today selector button */}
      <div className="flex items-center gap-2" id="date-picker-bottom-row">
        {/* Left Side: Manual Input Textfield */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={manualInput}
            onChange={handleManualInputChange}
            className={`w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-base text-stone-800 focus:outline-none focus:ring-2 font-mono font-bold transition duration-150 ${
              isValidDateString(manualInput)
                ? 'border-stone-200 focus:border-[#599e52] focus:ring-[#599e52]/10'
                : 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10 bg-rose-50/20'
            }`}
          />
          {!isValidDateString(manualInput) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-500">
              오류
            </span>
          )}
        </div>

        {/* Right Side: Quick select Today button formatted with M월 D일 */}
        <button
          type="button"
          onClick={handleSelectToday}
          className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition duration-150 cursor-pointer active:scale-95 whitespace-nowrap ${
            selectedDate === todayStr
              ? 'bg-[#f0f9f0] border-emerald-300 text-[#599e52]'
              : 'bg-white border-stone-250 text-stone-600 hover:bg-stone-50 hover:text-stone-850'
          }`}
          id="btn-quick-today-bottom"
        >
          {getTodayButtonLabel()}
        </button>
      </div>
    </div>
  );
}
