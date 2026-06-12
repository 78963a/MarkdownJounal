/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Edit3, Eye, FileText, HelpCircle, X, Check } from 'lucide-react';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown';

interface EditorProps {
  value: string; // HTML content from parent database
  onChange: (html: string) => void;
  placeholder?: string;
  borderless?: boolean;
  stickyTopClass?: string;
}

export default function Editor({ 
  value, 
  onChange, 
  placeholder = '오늘 하루 어떤 일이 있었나요? 마크다운(#, **, -, > 등)으로 기록해보세요.', 
  borderless = false, 
  stickyTopClass 
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [markdownValue, setMarkdownValue] = useState(() => htmlToMarkdown(value));
  
  // 'edit' | 'preview'
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  // Guide helper modal visibility state
  const [showGuide, setShowGuide] = useState(false);
  
  // Keeps track of the last HTML we communicated to the parent to prevent loop
  const lastHTMLValueRef = useRef(value);

  // Sync external changes (e.g. when loading a diary or clear)
  useEffect(() => {
    if (value !== lastHTMLValueRef.current) {
      setMarkdownValue(htmlToMarkdown(value));
      lastHTMLValueRef.current = value;
    }
  }, [value]);

  // Handle textarea text modifications
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const md = e.target.value;
    setMarkdownValue(md);
    
    // Convert markdown directly to HTML for IndexedDB storage
    const h = markdownToHtml(md);
    lastHTMLValueRef.current = h;
    onChange(h);
  };

  // Keyboard helper (Tab indentation inside markdown editor)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const newValue = val.substring(0, start) + '  ' + val.substring(end);
      setMarkdownValue(newValue);

      // We need to trigger change propagation
      const h = markdownToHtml(newValue);
      lastHTMLValueRef.current = h;
      onChange(h);

      // Delay selection reset after React re-renders the element
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className={
      borderless 
        ? "flex flex-col h-full bg-transparent" 
        : "border border-[#e2e8f0] rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col h-full min-h-[250px]"
    }>
      {/* 
        Clean modern minimalist layout bar with view mode toggle.
        No rich text WYSIWYG button pollution.
      */}
      <div className={
        borderless 
          ? `sticky ${stickyTopClass || 'top-0'} z-20 flex items-center justify-between p-3 bg-[#fdfcf9] border-b border-[#e2e8f0]/60 select-none` 
          : "flex items-center justify-between p-3 bg-[#fdfcf9] border-b border-[#e2e8f0] select-none"
      }>
        {/* Left Side: Single unified click button to summon the manual modal */}
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#599e52]/10 border border-[#599e52]/20 hover:bg-[#599e52]/20 rounded-xl text-[#306e2a] hover:text-[#255621] text-xs font-black transition cursor-pointer active:scale-95 duration-100"
          title="마크다운 작성 안내서 열기"
          id="btn-show-markdown-manual-header"
        >
          <HelpCircle className="w-4 h-4 text-[#599e52] shrink-0" />
          <span>마크다운 사용방법</span>
        </button>

        {/* Segmented Capsule Controller - 아주 예쁘고 직관적인 모드 스위치 */}
        <div className="flex bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer ${
              viewMode === 'edit'
                ? 'bg-[#599e52] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            id="editor-mode-edit-tab"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>에디터</span>
          </button>
          
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer ${
              viewMode === 'preview'
                ? 'bg-[#599e52] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            id="editor-mode-preview-tab"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>미리보기</span>
          </button>
        </div>
      </div>

      {/* Editor Body Wrapper */}
      <div className="flex-1 relative flex flex-col p-2 min-h-0">
        {viewMode === 'edit' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <textarea
              ref={textareaRef}
              value={markdownValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="flex-1 p-4 focus:outline-none font-mono text-base md:text-lg leading-relaxed text-[#1e293b] bg-[#fcfcfb] border-0 outline-none resize-none min-h-0"
              id="editor-md-plain-textarea"
              placeholder={placeholder}
            />
          </div>
        ) : (
          <div className="flex-1 p-5 overflow-y-auto bg-stone-50/40 rounded-xl min-h-0 select-text">
            {markdownValue.trim() ? (
              <div 
                className="prose max-w-none text-gray-800 leading-relaxed break-words text-base md:text-lg text-left" 
                dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownValue) }}
                id="editor-md-preview-rendered"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-stone-400 select-none">
                <p className="text-sm font-bold">미리보기 할 내용이 없습니다.</p>
                <p className="text-xs text-stone-400 mt-1">에디터 탭에서 마크다운 내용을 입력해보세요.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Markdown Manual Guide Modal (사용설명서 모달) */}
      {showGuide && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none"
          onClick={() => setShowGuide(false)}
          id="markdown-guide-backdrop"
        >
          <div 
            className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
            id="markdown-guide-modal"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#599e52]" />
                <span className="text-base font-black text-stone-800 font-sans">마크다운(Markdown) 사용설명서</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-55 rounded-full transition duration-150 cursor-pointer"
                id="btn-close-markdown-guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Helper contents */}
            <div className="flex flex-col gap-4 text-xs md:text-sm text-stone-700 leading-relaxed overflow-y-auto pr-1">
              <p className="text-xs text-stone-500 leading-normal font-sans bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                마크다운(Markdown)은 텍스트 기호를 입력해 글을 빠르고 우아하게 꾸밀 수 있는 도구입니다. 아래 양식을 따라서 에디터에 적어보세요.
              </p>

              {/* Grid or Groups */}
              <div className="flex flex-col gap-3 font-sans">
                {/* 1. Headings */}
                <div className="flex flex-col gap-1 border-b border-stone-100 pb-2">
                  <span className="font-extrabold text-stone-800 text-[13px] text-[#599e52]"># 제목 크기 조절 (헤더)</span>
                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded-xl border border-stone-150 font-mono text-[11px]">
                    <div>
                      <p className="font-bold text-stone-500">입력 코드</p>
                      <p className="text-stone-800 mt-0.5"># 커다란 대제목</p>
                      <p className="text-stone-800">## 중간 크기 제목</p>
                      <p className="text-stone-800">### 작은 소제목</p>
                    </div>
                    <div className="border-l border-stone-200 pl-2">
                      <p className="font-bold text-stone-500">실제 글 모양</p>
                      <p className="text-stone-900 font-black text-sm mt-0.5">커다란 대제목</p>
                      <p className="text-stone-900 font-extrabold text-xs">중간 크기 제목</p>
                      <p className="text-stone-950 font-bold text-[10px]">작은 소제목</p>
                    </div>
                  </div>
                </div>

                {/* 2. Styles */}
                <div className="flex flex-col gap-1 border-b border-stone-100 pb-2">
                  <span className="font-extrabold text-stone-800 text-[13px] text-[#599e52]">** 서식 강조 효과 (스타일)</span>
                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded-xl border border-stone-150 font-mono text-[11px]">
                    <div>
                      <p className="font-bold text-stone-500">입력 코드</p>
                      <p className="text-stone-800 mt-0.5">**텍스트 진하게**</p>
                      <p className="text-stone-800">*텍스트 기울여서*</p>
                      <p className="text-stone-800">~~텍스트 취소선~~</p>
                    </div>
                    <div className="border-l border-stone-200 pl-2">
                      <p className="font-bold text-stone-500">실제 글 모양</p>
                      <p className="text-stone-900 font-bold mt-0.5"><b>텍스트 진하게</b></p>
                      <p className="text-stone-900 italic">텍스트 기울여서</p>
                      <p className="text-stone-400 line-through">텍스트 취소선</p>
                    </div>
                  </div>
                </div>

                {/* 3. Bullet list and quotes */}
                <div className="flex flex-col gap-1 border-b border-stone-100 pb-2">
                  <span className="font-extrabold text-stone-800 text-[13px] text-[#599e52]">- 항목 및 인용하기</span>
                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded-xl border border-stone-150 font-mono text-[11px]">
                    <div>
                      <p className="font-bold text-stone-500">입력 코드</p>
                      <p className="text-stone-800 mt-0.5">- 오늘 할 일 첫번째</p>
                      <p className="text-stone-800">- 두번째 목록 작성</p>
                      <p className="text-stone-800 mt-1.5">&gt; 명언이나 좋은 글귀</p>
                    </div>
                    <div className="border-l border-stone-200 pl-2">
                      <p className="font-bold text-stone-500">실제 글 모양</p>
                      <ul className="list-disc list-inside text-stone-900 mt-0.5">
                        <li className="text-[11px]">오늘 할 일 첫번째</li>
                        <li className="text-[11px]">두번째 목록 작성</li>
                      </ul>
                      <div className="border-l-2 border-stone-300 pl-1.5 text-stone-500 italic mt-1 bg-stone-100/50 py-0.5">
                        명언이나 좋은 글귀
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Codes and lines */}
                <div className="flex flex-col gap-1 border-b border-stone-100 pb-2">
                  <span className="font-extrabold text-stone-800 text-[13px] text-[#599e52]">--- 구분선 및 코드</span>
                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded-xl border border-stone-150 font-mono text-[11px]">
                    <div>
                      <p className="font-bold text-stone-500">입력 코드</p>
                      <p className="text-stone-800 mt-0.5">--- (가로줄 긋기)</p>
                      <p className="text-stone-800 mt-1">`인라인 코드` 입력</p>
                    </div>
                    <div className="border-l border-stone-200 pl-2">
                      <p className="font-bold text-stone-500">실제 글 모양</p>
                      <hr className="border-stone-200 my-2" />
                      <p className="text-stone-900 mt-1"><code className="bg-stone-200 px-1 py-0.5 rounded text-[10px]">인라인 코드</code> 입력</p>
                    </div>
                  </div>
                </div>

                {/* 5. Links and Images */}
                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-stone-800 text-[13px] text-[#599e52]">[ ] 인터넷 링크 및 이미지 삽입</span>
                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded-xl border border-stone-150 font-mono text-[11px]">
                    <div>
                      <p className="font-bold text-stone-500">입력 코드</p>
                      <p className="text-stone-800 mt-0.5">[네이버](https://naver.com)</p>
                      <p className="text-stone-800 mt-2.5">![일기장](이미지_링크_주소)</p>
                    </div>
                    <div className="border-l border-stone-200 pl-2">
                      <p className="font-bold text-stone-500">실제 글 모양</p>
                      <a href="https://naver.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-bold mt-0.5 block">네이버 ↗</a>
                      <p className="text-stone-400 mt-2.5 text-[10px] italic bg-stone-100 px-1 rounded inline-block">이미지 액자 삽입</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full bg-[#599e52] hover:bg-[#4ba843] text-white text-xs font-bold py-3.5 rounded-2xl text-center shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              <Check className="w-4 h-4 stroke-[3px]" />
              설명서 확인 완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
