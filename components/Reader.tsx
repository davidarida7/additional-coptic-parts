
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { LibraryItem, Language, AppSettings } from '../types';

interface ReaderProps {
  book: LibraryItem | null;
  settings: AppSettings;
  targetSectionId: string | null;
  onTargetReached: () => void;
  onOverflow: (overflowing: boolean) => void;
}

export const Reader: React.FC<ReaderProps> = ({ book, settings, targetSectionId, onTargetReached, onOverflow }) => {
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastBookIdRef = useRef<string | null>(null);

  // Flatten book sections into parts for easy linear navigation
  const allParts = useMemo(() => {
    if (!book || !book.sections) return [];
    return book.sections.flatMap(section => 
      section.parts.map(part => ({ ...part, sectionTitle: section.title, sectionId: section.id }))
    );
  }, [book]);

  // Ensure currentPartIndex is always within bounds of the current allParts array
  // This prevents crashes during book transitions before the useLayoutEffect can reset the index
  const safeIndex = currentPartIndex < allParts.length ? currentPartIndex : 0;
  const safeCurrentPart = allParts[safeIndex];

  // Language management
  const primaryLangs = [Language.ENGLISH, Language.COPTIC, Language.ARABIC];
  const secondaryLangs = [Language.TRANSLITERATED_ENGLISH, Language.TRANSLITERATED_ARABIC];

  const getActiveLangsForTier = (tier: Language[]) => {
    const globalOrdered = tier.filter(l => settings.languages.includes(l));
    if (!safeCurrentPart) return [];
    return globalOrdered.filter(lang => {
      const content = safeCurrentPart.content[lang];
      return content && content.length > 0 && content.some(p => p.trim() !== '');
    });
  };

  const activePrimaryLangs = useMemo(() => getActiveLangsForTier(primaryLangs), [safeCurrentPart, settings.languages]);
  const activeSecondaryLangs = useMemo(() => getActiveLangsForTier(secondaryLangs), [safeCurrentPart, settings.languages]);

  const sectionStats = useMemo(() => {
    if (!safeCurrentPart || allParts.length === 0) return { index: 0, total: 0 };
    const sectionParts = allParts.filter(p => p.sectionId === safeCurrentPart.sectionId);
    const indexInSection = sectionParts.findIndex(p => p.id === safeCurrentPart.id);
    return { index: indexInSection + 1, total: sectionParts.length };
  }, [allParts, safeCurrentPart]);

  // Overflow Detection
  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current && containerRef.current) {
        const isTooBig = contentRef.current.scrollHeight > (containerRef.current.clientHeight * 0.9);
        onOverflow(isTooBig);
      }
    };
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    if (containerRef.current) ro.observe(containerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [safeCurrentPart, settings.fontSize, activePrimaryLangs, activeSecondaryLangs, onOverflow]);

  // ROBUST NAVIGATION LOGIC
  useLayoutEffect(() => {
    if (!book || allParts.length === 0) return;

    const bookChanged = lastBookIdRef.current !== book.id;

    if (targetSectionId) {
      const targetIndex = allParts.findIndex(p => p.sectionId === targetSectionId);
      if (targetIndex !== -1) {
        setCurrentPartIndex(targetIndex);
        onTargetReached();
        lastBookIdRef.current = book.id;
        return;
      }
    }

    if (bookChanged) {
      setCurrentPartIndex(0);
      lastBookIdRef.current = book.id;
    }
  }, [book?.id, targetSectionId, allParts, onTargetReached]);

  if (!book || !book.sections || allParts.length === 0 || !safeCurrentPart) {
    return (
      <div className="flex-1 flex flex-col bg-black animate-fadeIn relative overflow-hidden h-screen w-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#c5a059]/5 via-transparent to-transparent opacity-30" />
        <div className="flex-1 flex flex-col items-center justify-center pt-16 px-8 text-center relative z-10">
          <h1 className="text-2xl md:text-5xl font-cinzel gold-text font-bold tracking-[0.6em] mb-12 md:mb-20 uppercase drop-shadow-[0_0_15px_rgba(197,160,89,0.3)] leading-tight">
            Additional Coptic Parts
          </h1>
          <div className="w-48 h-48 md:w-80 md:h-80 opacity-95 transition-transform duration-1000 hover:scale-105">
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_40px_rgba(255,255,255,0.05)]">
              <path d="M100 15V185M15 100H185" stroke="white" strokeWidth="4" strokeLinecap="round"/>
              <path d="M100 15L85 35H115L100 15ZM100 185L85 165H115L100 185ZM15 100L35 85V115L15 100ZM185 100L165 85V115L185 100Z" fill="white"/>
              <circle cx="100" cy="100" r="24" stroke="white" strokeWidth="3" fill="black"/>
              <path d="M100 82V118M82 100H118" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M100 82L94 88H106L100 82ZM100 118L94 112H106L100 118ZM82 100L88 94V106L82 100ZM118 100L112 94V106L118 100Z" fill="white"/>
              <text x="45" y="55" fill="white" className="font-coptic text-[16px] font-bold">Ⲓⲏⲥ</text>
              <text x="135" y="55" fill="white" className="font-coptic text-[16px] font-bold">Ⲡⲭⲥ</text>
              <text x="35" y="155" fill="white" className="font-coptic text-[16px] font-bold">Ⲡ̀ϣⲏⲣⲓ</text>
              <text x="135" y="155" fill="white" className="font-coptic text-[16px] font-bold">ⲙ̀ⲫϯ</text>
            </svg>
          </div>
          <p className="mt-16 font-cinzel text-[10px] md:text-xs text-gray-500 tracking-[0.5em] uppercase opacity-30 animate-pulse">
            Select a book from the sidebar to begin
          </p>
        </div>
      </div>
    );
  }

  const handlePresentationClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, currentTarget } = e;
    const { width } = currentTarget.getBoundingClientRect();
    if (clientX < width / 2) setCurrentPartIndex(prev => Math.max(0, prev - 1));
    else setCurrentPartIndex(prev => Math.min(allParts.length - 1, prev + 1));
  };

  const renderPartContent = (part: any) => {
    if (!part) return null;
    const allActive = [...activePrimaryLangs, ...activeSecondaryLangs];
    const maxParagraphs = Math.max(...allActive.map(lang => (part.content[lang] || []).length), 0);
    const getGridClass = (count: number) => count === 3 ? 'grid-cols-3' : count === 2 ? 'grid-cols-2' : 'grid-cols-1';

    return (
      <div ref={contentRef} key={part.id} className="w-full animate-fadeIn transition-all duration-500 select-none max-w-[95vw] mx-auto py-10">
        <div className="text-center mb-10 md:mb-16">
          <span className="text-[10px] md:text-xs tracking-[0.5em] gold-text opacity-40 uppercase font-cinzel">
            {part.sectionTitle}
          </span>
        </div>
        <div className="flex flex-col space-y-12 md:space-y-16 w-full">
          {Array.from({ length: maxParagraphs }).map((_, pIndex) => (
            <div key={`${part.id}-block-${pIndex}`} className="flex flex-col space-y-6 md:space-y-10">
              {activePrimaryLangs.length > 0 && (
                <div className={`grid gap-8 md:gap-16 ${getGridClass(activePrimaryLangs.length)} w-full items-start px-4 md:px-0`}>
                  {activePrimaryLangs.map((lang) => {
                    const content = part.content[lang] || [];
                    const p = content[pIndex];
                    const isAr = lang === Language.ARABIC;
                    return (
                      <div key={`${lang}-${pIndex}`} className={isAr ? 'text-right' : 'text-left'} dir={isAr ? 'rtl' : 'ltr'}>
                        {p && (
                          <div className={`leading-[1.6] text-gray-100 transition-all ${lang === Language.COPTIC ? 'font-coptic' : isAr ? 'font-arabic' : 'font-inter'}`}
                               style={{ fontSize: `${settings.fontSize}px` }}>
                            <p>{p}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {activeSecondaryLangs.length > 0 && (
                <div className={`grid gap-8 md:gap-16 ${getGridClass(activeSecondaryLangs.length)} w-full items-start px-4 md:px-0`}>
                  {activeSecondaryLangs.map((lang) => {
                    const content = part.content[lang] || [];
                    const p = content[pIndex];
                    const isAr = lang === Language.TRANSLITERATED_ARABIC;
                    return (
                      <div key={`${lang}-${pIndex}`} className={isAr ? 'text-right' : 'text-left'} dir={isAr ? 'rtl' : 'ltr'}>
                        {p && (
                          <div className={`leading-[1.4] gold-text opacity-70 transition-all italic ${isAr ? 'font-arabic' : 'font-inter'}`}
                               style={{ fontSize: `${settings.fontSize * 0.75}px` }}>
                            <p>{p}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} onClick={handlePresentationClick} className="flex-1 flex flex-col min-h-0 bg-black relative overflow-hidden cursor-pointer">
      <div className="flex-1 flex flex-col items-center w-full px-6 md:px-12 py-10 justify-center overflow-hidden">
        <div className="w-full h-full flex flex-col justify-center animate-fadeIn relative">
          <div className="w-full transition-all duration-700">
            {renderPartContent(safeCurrentPart)}
          </div>
        </div>
      </div>
      <div className="fixed bottom-8 right-8 z-[80] select-none pointer-events-none">
         <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 shadow-2xl flex flex-col items-center">
           <span className="font-cinzel text-[10px] md:text-xs text-gray-400 tracking-[0.3em] uppercase">
             {sectionStats.index} <span className="opacity-30 mx-1">/</span> {sectionStats.total}
           </span>
         </div>
      </div>
    </div>
  );
};
