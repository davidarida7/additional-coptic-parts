
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
  
  // Track the current book ID to detect when the book actually changes
  const lastBookIdRef = useRef<string | null>(null);

  // 1. Flatten sections and parts for navigation
  const allParts = useMemo(() => {
    if (!book || !book.sections) return [];
    return book.sections.flatMap(section => 
      section.parts.map(part => ({ ...part, sectionTitle: section.title, sectionId: section.id }))
    );
  }, [book]);

  const safeCurrentPart = allParts[currentPartIndex];

  // 2. Language grouping logic for layout
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

  // 3. Calculate Section-specific page count
  const sectionStats = useMemo(() => {
    if (!safeCurrentPart || allParts.length === 0) return { index: 0, total: 0 };
    
    const sectionParts = allParts.filter(p => p.sectionId === safeCurrentPart.sectionId);
    const indexInSection = sectionParts.findIndex(p => p.id === safeCurrentPart.id);
    
    return {
      index: indexInSection + 1,
      total: sectionParts.length
    };
  }, [allParts, safeCurrentPart]);

  // 4. Overflow Detection Logic
  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current && containerRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const containerHeight = containerRef.current.clientHeight;
        const isTooBig = contentHeight > (containerHeight * 0.9);
        onOverflow(isTooBig);
      }
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    return () => resizeObserver.disconnect();
  }, [safeCurrentPart, settings.fontSize, activePrimaryLangs, activeSecondaryLangs, onOverflow]);

  // 5. DETERMINISTIC NAVIGATION LOGIC
  // We separate "Book Change" from "Section Jump" to prevent conflict
  useEffect(() => {
    if (!book) {
      lastBookIdRef.current = null;
      return;
    }

    const bookChanged = lastBookIdRef.current !== book.id;
    
    // Scenario A: User clicked a specific section (highest priority)
    if (targetSectionId) {
      const sectionFirstPartIndex = allParts.findIndex(p => p.sectionId === targetSectionId);
      if (sectionFirstPartIndex !== -1) {
        setCurrentPartIndex(sectionFirstPartIndex);
        onTargetReached(); // Clear the target in parent
        lastBookIdRef.current = book.id; // Mark book as synced
        return;
      }
    } 
    
    // Scenario B: User clicked a book (or book changed) without a specific section target
    if (bookChanged) {
      setCurrentPartIndex(0);
      lastBookIdRef.current = book.id;
    }
  }, [book, targetSectionId, allParts, onTargetReached]);

  // Safety check for index out of bounds
  useEffect(() => {
    if (currentPartIndex >= allParts.length && allParts.length > 0) {
      setCurrentPartIndex(0);
    }
  }, [allParts.length, currentPartIndex]);

  // LANDING PAGE RENDER
  if (!book || !book.sections || allParts.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-black animate-fadeIn relative overflow-hidden h-screen w-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#c5a059]/5 via-transparent to-transparent opacity-30" />
        
        {/* Absolute centering with top-offset for header handle clearance */}
        <div className="flex-1 flex flex-col items-center justify-center pt-20 px-8 text-center relative z-10">
          <h1 className="text-2xl md:text-5xl font-cinzel gold-text font-bold tracking-[0.6em] mb-12 md:mb-20 uppercase drop-shadow-[0_0_15px_rgba(197,160,89,0.3)] leading-tight">
            Additional Coptic Parts
          </h1>

          <div className="w-56 h-56 md:w-80 md:h-80 opacity-95 transition-transform duration-1000 hover:scale-105">
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
    if (clientX < width / 2) {
      setCurrentPartIndex(prev => Math.max(0, prev - 1));
    } else {
      setCurrentPartIndex(prev => Math.min(allParts.length - 1, prev + 1));
    }
  };

  const renderPart = (part: any) => {
    if (!part) return null;

    const allActive = [...activePrimaryLangs, ...activeSecondaryLangs];
    const maxParagraphs = Math.max(
      ...allActive.map(lang => (part.content[lang] || []).length)
    );

    const getGridClass = (count: number) => {
      if (count === 3) return 'grid-cols-3';
      if (count === 2) return 'grid-cols-2';
      return 'grid-cols-1';
    };

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
              {/* Row 1: Primary Languages (EN, COP, AR) */}
              {activePrimaryLangs.length > 0 && (
                <div className={`grid gap-8 md:gap-16 ${getGridClass(activePrimaryLangs.length)} w-full items-start px-4 md:px-0`}>
                  {activePrimaryLangs.map((lang) => {
                    const content = part.content[lang] || [];
                    const paragraph = content[pIndex];
                    const isArabic = lang === Language.ARABIC;

                    return (
                      <div key={`${lang}-${pIndex}`} className={`${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'}>
                        {paragraph && (
                          <div 
                            className={`leading-[1.6] text-gray-100 transition-all ${
                              lang === Language.COPTIC ? 'font-coptic' : 
                              isArabic ? 'font-arabic' : 'font-inter'
                            }`}
                            style={{ fontSize: `${settings.fontSize}px`, lineHeight: '1.6' }}
                          >
                            <p>{paragraph}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Row 2: Secondary Languages (TRAN-EN, TRAN-AR) */}
              {activeSecondaryLangs.length > 0 && (
                <div className={`grid gap-8 md:gap-16 ${getGridClass(activeSecondaryLangs.length)} w-full items-start px-4 md:px-0`}>
                  {activeSecondaryLangs.map((lang) => {
                    const content = part.content[lang] || [];
                    const paragraph = content[pIndex];
                    const isArabic = lang === Language.TRANSLITERATED_ARABIC;

                    return (
                      <div key={`${lang}-${pIndex}`} className={`${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'}>
                        {paragraph && (
                          <div 
                            className={`leading-[1.4] gold-text opacity-70 transition-all italic ${
                              isArabic ? 'font-arabic' : 'font-inter'
                            }`}
                            style={{ fontSize: `${settings.fontSize * 0.75}px`, lineHeight: '1.4' }}
                          >
                            <p>{paragraph}</p>
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
    <div 
      ref={containerRef}
      onClick={handlePresentationClick}
      className="flex-1 flex flex-col min-h-0 bg-black relative overflow-hidden cursor-pointer"
    >
      <div className="flex-1 flex flex-col items-center w-full px-6 md:px-12 py-10 justify-center overflow-hidden">
        <div className="w-full max-w-full h-full flex flex-col justify-center animate-fadeIn relative">
          <div className="w-full transition-all duration-700">
            {renderPart(safeCurrentPart)}
          </div>

          <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/5 to-transparent flex items-center justify-center">
               <div className="w-px h-16 bg-white/10 rounded-full" />
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/5 to-transparent flex items-center justify-center">
               <div className="w-px h-16 bg-white/10 rounded-full" />
            </div>
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
