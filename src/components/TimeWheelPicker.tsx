import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Clock } from 'lucide-react';

interface TimeWheelPickerProps {
  value: string; // Format: "오후 02:34" or "오전 12:00"
  onChange: (val: string) => void;
  onClose: () => void;
}

const ampmOptions = ['오전', '오후'];
const hourOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const ITEM_HEIGHT = 40; // Smaller height (40px) to make the overall picker modal more compact

export default function TimeWheelPicker({ value, onChange, onClose }: TimeWheelPickerProps) {
  // Parsing value
  const parseTime = (timeStr: string) => {
    const defaultVal = { ampm: '오전', hour: '12', minute: '00' };
    if (!timeStr) return defaultVal;

    const match = timeStr.trim().match(/^(오전|오후)\s+(\d{1,2}):(\d{2})$/);
    if (!match) return defaultVal;

    return {
      ampm: match[1],
      hour: String(parseInt(match[2], 10)).padStart(2, '0'),
      minute: match[3],
    };
  };

  const initialTime = parseTime(value);

  const [selectedAmpm, setSelectedAmpm] = useState(initialTime.ampm);
  const [selectedHour, setSelectedHour] = useState(initialTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(initialTime.minute);
  
  // For manual text input synchronization
  const getFormattedString = (ampm: string, h: string, m: string) => {
    return `${ampm} ${h}:${m}`;
  };
  
  const [manualInput, setManualInput] = useState(() => getFormattedString(initialTime.ampm, initialTime.hour, initialTime.minute));

  const ampmRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const isWritingRef = useRef(false);

  // Helper to get current dynamic local time in "오후 02:34" format
  const getKoreanFormattedTime = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12; // first hour is 12
    return {
      ampm,
      hour: String(hours).padStart(2, '0'),
      minute: minutes,
    };
  };

  const handleSetCurrentTime = () => {
    const current = getKoreanFormattedTime();
    isWritingRef.current = true;
    setSelectedAmpm(current.ampm);
    setSelectedHour(current.hour);
    setSelectedMinute(current.minute);
    
    const formatted = getFormattedString(current.ampm, current.hour, current.minute);
    setManualInput(formatted);

    // Scroll to new positions
    setTimeout(() => {
      scrollToValue('ampm', current.ampm);
      scrollToValue('hour', current.hour);
      scrollToValue('minute', current.minute);
      isWritingRef.current = false;
    }, 50);
  };

  const scrollToValue = (type: 'ampm' | 'hour' | 'minute', val: string) => {
    let index = 0;
    let ref: React.RefObject<HTMLDivElement | null>;

    if (type === 'ampm') {
      index = ampmOptions.indexOf(val);
      ref = ampmRef;
    } else if (type === 'hour') {
      index = hourOptions.indexOf(val);
      ref = hourRef;
    } else {
      index = minuteOptions.indexOf(val);
      ref = minuteRef;
    }

    if (ref && ref.current && index !== -1) {
      ref.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  };

  // Setup scroll event listeners and initial positions
  useEffect(() => {
    isWritingRef.current = true;
    scrollToValue('ampm', selectedAmpm);
    scrollToValue('hour', selectedHour);
    scrollToValue('minute', selectedMinute);
    setTimeout(() => {
      isWritingRef.current = false;
    }, 400);
  }, []);

  // Update selected picker states during mouse/wheel scrolling
  const handleScrollDetect = (type: 'ampm' | 'hour' | 'minute') => (e: React.UIEvent<HTMLDivElement>) => {
    if (isWritingRef.current) return;

    const scrollTop = e.currentTarget.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);

    let nextAmpm = selectedAmpm;
    let nextHour = selectedHour;
    let nextMinute = selectedMinute;

    if (type === 'ampm') {
      const clampedIndex = Math.max(0, Math.min(index, ampmOptions.length - 1));
      const val = ampmOptions[clampedIndex];
      if (val && val !== selectedAmpm) {
        setSelectedAmpm(val);
        nextAmpm = val;
      }
    } else if (type === 'hour') {
      const clampedIndex = Math.max(0, Math.min(index, hourOptions.length - 1));
      const val = hourOptions[clampedIndex];
      if (val && val !== selectedHour) {
        setSelectedHour(val);
        nextHour = val;
      }
    } else if (type === 'minute') {
      const clampedIndex = Math.max(0, Math.min(index, minuteOptions.length - 1));
      const val = minuteOptions[clampedIndex];
      if (val && val !== selectedMinute) {
        setSelectedMinute(val);
        nextMinute = val;
      }
    }

    setManualInput(getFormattedString(nextAmpm, nextHour, nextMinute));
  };

  const handleSelectItem = (type: 'ampm' | 'hour' | 'minute', val: string) => {
    isWritingRef.current = true;
    let nextAmpm = selectedAmpm;
    let nextHour = selectedHour;
    let nextMinute = selectedMinute;

    if (type === 'ampm') {
      setSelectedAmpm(val);
      nextAmpm = val;
    } else if (type === 'hour') {
      setSelectedHour(val);
      nextHour = val;
    } else {
      setSelectedMinute(val);
      nextMinute = val;
    }

    setManualInput(getFormattedString(nextAmpm, nextHour, nextMinute));
    scrollToValue(type, val);
    setTimeout(() => {
      isWritingRef.current = false;
    }, 200);
  };

  // Validate manually entered string like "오후 02:34" or "오전 9:05"
  const isValidTimeString = (text: string) => {
    return /^(오전|오후)\s+(0?[1-9]|1[0-2]):[0-5]\d$/.test(text.trim());
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setManualInput(text);

    if (isValidTimeString(text)) {
      const match = text.trim().match(/^(오전|오후)\s+(\d{1,2}):(\d{2})$/);
      if (match) {
        const nextAmpm = match[1];
        const nextHour = String(parseInt(match[2], 10)).padStart(2, '0');
        const nextMinute = match[3];

        setSelectedAmpm(nextAmpm);
        setSelectedHour(nextHour);
        setSelectedMinute(nextMinute);

        isWritingRef.current = true;
        scrollToValue('ampm', nextAmpm);
        scrollToValue('hour', nextHour);
        scrollToValue('minute', nextMinute);
        setTimeout(() => {
          isWritingRef.current = false;
        }, 100);
      }
    }
  };

  const handleApply = () => {
    const finalVal = getFormattedString(selectedAmpm, selectedHour, selectedMinute);
    onChange(finalVal);
    onClose();
  };

  // Button label generator for "현재 시각(오후 12:34)"
  const getCurrentTimeBtnLabel = () => {
    try {
      const current = getKoreanFormattedTime();
      return `현재(${current.ampm} ${current.hour}:${current.minute})`;
    } catch {
      return '현재 시각';
    }
  };

  const activeTimeDisplay = getFormattedString(selectedAmpm, selectedHour, selectedMinute);

  return (
    <div 
      className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-sm p-5 text-left flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
      id="time-wheel-picker-modal"
    >
      {/* 1. Header Toolbar Row (Identical layout to DateSelectionPicker) */}
      <div className="flex items-center justify-between" id="time-picker-toolbar">
        {/* Left Side: Check Confirm Button (Green background, rounded) */}
        <button
          type="button"
          onClick={handleApply}
          className="p-2.5 rounded-full bg-[#599e52] hover:bg-[#4ba843] text-white shadow-xs transition cursor-pointer active:scale-95 flex items-center justify-center animate-none"
          id="btn-apply-time-top"
          title="시간 입력하기"
        >
          <Check className="w-4 h-4 stroke-[3px]" />
        </button>

        {/* Center: Selected dynamic active time, borderless, clean layout */}
        <div className="flex-1 text-center" id="time-picker-header-title">
          <span className="text-stone-800 text-sm font-extrabold tracking-tight font-mono">
            {selectedAmpm} <span className="text-[#599e52]">{selectedHour}</span>시 <span className="text-[#599e52]">{selectedMinute}</span>분
          </span>
        </div>

        {/* Right Side: Simple Close Button (No background) */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition duration-150 cursor-pointer active:scale-95"
          id="btn-close-time-top"
          title="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Interactive Column Scroller Drum (More Compact height 120px with only 3 visible items) */}
      <div className="relative h-[120px] bg-stone-50 border border-stone-150 rounded-2xl flex select-none overflow-hidden" id="compact-drum-wheels">
        {/* Center highlighter glasses */}
        <div 
          className="absolute inset-x-0 w-full bg-[#599e52]/7 border-t border-b border-[#599e52]/20 pointer-events-none" 
          style={{ top: '40px', height: `${ITEM_HEIGHT}px` }}
          id="highlighter-laser-guide"
        />

        {/* Column 1: AM/PM */}
        <div 
          ref={ampmRef}
          onScroll={handleScrollDetect('ampm')}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-none text-center"
          style={{ scrollPaddingTop: '40px', scrollPaddingBottom: '40px' }}
          id="ampm-scroller"
        >
          <div style={{ height: '40px' }} />
          {ampmOptions.map((opt) => {
            const isSelected = selectedAmpm === opt;
            return (
              <div
                key={opt}
                onClick={() => handleSelectItem('ampm', opt)}
                className={`h-[40px] flex items-center justify-center snap-center cursor-pointer text-xs transition-all duration-150 ${
                  isSelected 
                    ? 'text-[#599e52] font-black scale-110' 
                    : 'text-stone-400 font-bold hover:text-stone-600 scale-95'
                }`}
              >
                {opt}
              </div>
            );
          })}
          <div style={{ height: '40px' }} />
        </div>

        {/* Divider */}
        <div className="w-[1px] bg-stone-200/60 my-2" />

        {/* Column 2: Hours */}
        <div 
          ref={hourRef}
          onScroll={handleScrollDetect('hour')}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-none text-center font-mono"
          style={{ scrollPaddingTop: '40px', scrollPaddingBottom: '40px' }}
          id="hour-scroller"
        >
          <div style={{ height: '40px' }} />
          {hourOptions.map((opt) => {
            const isSelected = selectedHour === opt;
            return (
              <div
                key={opt}
                onClick={() => handleSelectItem('hour', opt)}
                className={`h-[40px] flex items-center justify-center snap-center cursor-pointer tracking-wider text-sm transition-all duration-150 ${
                  isSelected 
                    ? 'text-[#599e52] font-black scale-115' 
                    : 'text-stone-400 font-bold hover:text-stone-600 scale-90'
                }`}
              >
                {opt} <span className="text-[10px] font-sans ml-0.5 opacity-80 select-none">시</span>
              </div>
            );
          })}
          <div style={{ height: '40px' }} />
        </div>

        {/* Divider */}
        <div className="w-[1px] bg-stone-200/60 my-2" />

        {/* Column 3: Minutes */}
        <div 
          ref={minuteRef}
          onScroll={handleScrollDetect('minute')}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-none text-center font-mono"
          style={{ scrollPaddingTop: '40px', scrollPaddingBottom: '40px' }}
          id="minute-scroller"
        >
          <div style={{ height: '40px' }} />
          {minuteOptions.map((opt) => {
            const isSelected = selectedMinute === opt;
            return (
              <div
                key={opt}
                onClick={() => handleSelectItem('minute', opt)}
                className={`h-[40px] flex items-center justify-center snap-center cursor-pointer tracking-wider text-sm transition-all duration-150 ${
                  isSelected 
                    ? 'text-[#599e52] font-black scale-115' 
                    : 'text-stone-400 font-bold hover:text-stone-600 scale-90'
                }`}
              >
                {opt} <span className="text-[10px] font-sans ml-0.5 opacity-80 select-none">분</span>
              </div>
            );
          })}
          <div style={{ height: '40px' }} />
        </div>

        {/* Cylinder Visual Fade Overlays */}
        <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-stone-50 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-stone-50 to-transparent pointer-events-none" />
      </div>

      {/* 3. Bottom Row: Left side direct text input, Right side "현재 시각" button */}
      <div className="flex items-center gap-2" id="time-picker-bottom-row">
        {/* Left Side: Manual Input Textfield */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="오후 02:30"
            value={manualInput}
            onChange={handleManualInputChange}
            className={`w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-base text-stone-800 focus:outline-none focus:ring-2 font-mono font-bold transition duration-150 ${
              isValidTimeString(manualInput)
                ? 'border-stone-200 focus:border-[#599e52] focus:ring-[#599e52]/10'
                : 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10 bg-rose-50/20'
            }`}
          />
          {!isValidTimeString(manualInput) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-rose-500">
              오류
            </span>
          )}
        </div>

        {/* Right Side: Quick select Current Time button */}
        <button
          type="button"
          onClick={handleSetCurrentTime}
          className="px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-850 font-bold text-xs transition duration-150 cursor-pointer active:scale-95 whitespace-nowrap flex items-center gap-1 shadow-3xs"
          id="btn-quick-current-time-bottom"
        >
          <Clock className="w-3.5 h-3.5 text-[#599e52] mr-0.5" />
          {getCurrentTimeBtnLabel()}
        </button>
      </div>
    </div>
  );
}
