import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { LibraryItem, Language, AppSettings } from '../types.ts';

interface ReaderProps {
  book: LibraryItem | null;
  settings: AppSettings;
  targetSectionId: string | null;
  onTargetReached: () => void;
  onOverflow: (overflowing: boolean) => void;
}

interface ComputedSlide {
  type: 'title' | 'content';
  sectionTitle: string;
  sectionId: string;
  content?: { [key in Language]?: string[] };
  slideIndex: number;
  totalSlidesInSection: number;
}

export const Reader: React.FC<ReaderProps> = ({ book, settings, targetSectionId, onTargetReached, onOverflow }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastBookIdRef = useRef<string | null>(null);

  const primaryLangs = [Language.ENGLISH, Language.COPTIC, Language.ARABIC];
  const secondaryLangs = [Language.TRANSLITERATED_ENGLISH, Language.TRANSLITERATED_ARABIC];

  /**
   * REVISED HEIGHT-PARITY FOOTPRINTS:
   * To match column heights, we must give "taller" scripts more horizontal space.
   * Arabic is dense vertically, so we increase its horizontal footprint to squash its height.
   */
  const getLangHorizontalFootprint = (lang: Language) => {
    switch (lang) {
      case Language.COPTIC: return 2.2; 
      case Language.ARABIC: return 1.6; // Increased further for better height parity
      case Language.TRANSLITERATED_ARABIC: return 1.4; 
      case Language.TRANSLITERATED_ENGLISH: return 1.15;
      default: return 1.15;
    }
  };

  const getScaledFontSize = (lang: Language, baseSize: number) => {
    switch (lang) {
      case Language.COPTIC: return baseSize * 1.25; 
      case Language.ARABIC: 
      case Language.TRANSLITERATED_ARABIC: return baseSize * 1.15; 
      default: return baseSize; 
    }
  };

  const allSlides = useMemo(() => {
    if (!book || !book.sections) return [];
    const computed: ComputedSlide[] = [];
    
    book.sections.forEach(section => {
      computed.push({
        type: 'title',
        sectionTitle: section.title,
        sectionId: section.id,
        slideIndex: 0,
        totalSlidesInSection: section.parts.length,
      });

      section.parts.forEach((part, partIdx) => {
        computed.push({
          type: 'content',
          sectionTitle: section.title,
          sectionId: section.id,
          content: part.content,
          slideIndex: partIdx + 1,
          totalSlidesInSection: section.parts.length,
        });
      });
    });

    return computed;
  }, [book]);

  const safeSlide = allSlides[currentSlideIndex] || null;

  /**
   * VERTICAL ALIGNMENT ENGINE:
   * Dynamically balances widths to minimize height discrepancies.
   */
  const currentColumnWidths = useMemo(() => {
    if (!safeSlide || safeSlide.type === 'title') return {};
    
    const slideActivePrimary = primaryLangs.filter(l => 
      settings.languages.includes(l) && 
      safeSlide.content?.[l]?.some(text => text.trim())
    );

    const pressure = Math.pow(settings.fontSize / 22, 1.4);

    const primaryWeights = slideActivePrimary.map(l => {
      const stanzas = safeSlide.content?.[l] || [];
      const maxStanzaLength = stanzas.reduce((max, s) => Math.max(max, s.length), 0);
      const footprint = getLangHorizontalFootprint(l);
      return Math.max(100, maxStanzaLength * footprint * pressure);
    });

    const totalWeight = primaryWeights.reduce((a, b) => a + b, 0) || 1;
    const widths: { [key: string]: string } = {};
    
    slideActivePrimary.forEach((l, i) => {
      widths[l] = `${(primaryWeights[i] / totalWeight) * 100}fr`;
    });

    return widths;
  }, [safeSlide, settings.languages, settings.fontSize]);

  const activePrimary = useMemo(() => {
    if (!safeSlide || safeSlide.type === 'title') return [];
    return primaryLangs.filter(lang => 
      settings.languages.includes(lang) && 
      safeSlide.content?.[lang]?.some(p => p.trim() !== '')
    );
  }, [safeSlide, settings.languages]);

  const activeSecondary = useMemo(() => {
    if (!safeSlide || safeSlide.type === 'title') return [];
    return secondaryLangs.filter(lang => 
      settings.languages.includes(lang) && 
      safeSlide.content?.[lang]?.some(p => p.trim() !== '')
    );
  }, [safeSlide, settings.languages]);

  const getGridStyle = (langs: Language[]) => {
    if (langs.length <= 1 || !safeSlide) return { gridTemplateColumns: '1fr' };
    const frs = langs.map(l => currentColumnWidths[l] || '1fr').join(' ');
    return { gridTemplateColumns: frs, gap: '0.75rem' }; 
  };

  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current && containerRef.current) {
        const isTooBig = contentRef.current.scrollHeight > (containerRef.current.clientHeight * 0.98);
        onOverflow(isTooBig);
      }
    };
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    if (containerRef.current) ro.observe(containerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [safeSlide, settings.fontSize, onOverflow, currentColumnWidths]);

  useLayoutEffect(() => {
    if (!book || allSlides.length === 0) return;
    const bookChanged = lastBookIdRef.current !== book.id;
    if (targetSectionId) {
      const idx = allSlides.findIndex(s => s.sectionId === targetSectionId);
      if (idx !== -1) {
        setCurrentSlideIndex(idx);
        onTargetReached();
        lastBookIdRef.current = book.id;
        return;
      }
    }
    if (bookChanged) {
      setCurrentSlideIndex(0);
      lastBookIdRef.current = book.id;
    }
  }, [book?.id, targetSectionId, allSlides, onTargetReached]);

  const handleNav = (e: React.MouseEvent) => {
    const { clientX, currentTarget } = e;
    const { width } = currentTarget.getBoundingClientRect();
    if (clientX < width / 3) setCurrentSlideIndex(prev => Math.max(0, prev - 1));
    else setCurrentSlideIndex(prev => Math.min(allSlides.length - 1, prev + 1));
  };

  if (!book || !safeSlide) {
    return (
      <div className="flex-1 flex flex-col bg-black animate-fadeIn relative h-screen w-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#c5a05911_0%,_transparent_70%)] opacity-30" />
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
            Select a book to begin
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER TITLE SLIDE (MULTI-LINE & SCRIPT AWARE) ---
  if (safeSlide.type === 'title') {
    // Split by explicit delimiters, then further split where English meets Arabic/Coptic
    const titleParts = safeSlide.sectionTitle
      .split(/[/|]|\n/)
      .flatMap(p => {
        // Regex splits boundary between Latin (a-zA-Z) and Non-Latin scripts (Arabic, Coptic)
        return p.split(/(?<=[a-zA-Z0-9.,!?;:])\s+(?=[\u0600-\u06FF\u2C80-\u2CFF\u0370-\u03FF])|(?<=[\u0600-\u06FF\u2C80-\u2CFF\u0370-\u03FF])\s+(?=[a-zA-Z0-9.,!?;:])/);
      })
      .map(p => p.trim())
      .filter(Boolean);

    return (
      <div onClick={handleNav} className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden cursor-pointer select-none items-center justify-center p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#c5a05908_0%,_transparent_70%)]" />
        <div className="max-w-5xl text-center animate-fadeIn flex flex-col gap-6 md:gap-8">
          <div className="w-24 h-[1px] bg-[#c5a059] mx-auto opacity-30" />
          {titleParts.map((part, i) => {
            const isArabic = /[\u0600-\u06FF]/.test(part);
            const isCoptic = /[\u2C80-\u2CFF\u0370-\u03FF]/.test(part);
            return (
              <h2 key={i} 
                  className={`text-3xl md:text-6xl gold-text font-bold tracking-[0.2em] uppercase leading-tight drop-shadow-2xl ${isArabic ? 'font-arabic' : isCoptic ? 'font-coptic' : 'font-cinzel'}`}
                  dir={isArabic ? 'rtl' : 'ltr'}>
                {part}
              </h2>
            );
          })}
          <div className="w-24 h-[1px] bg-[#c5a059] mx-auto opacity-30" />
        </div>
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 opacity-20 font-cinzel text-[10px] tracking-[0.8em] gold-text uppercase animate-pulse">
          Click to proceed
        </div>
      </div>
    );
  }

  // --- RENDER CONTENT SLIDE ---
  return (
    <div ref={containerRef} onClick={handleNav} className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden cursor-pointer select-none pt-2 px-2 md:pt-4 md:px-4">
      <div className="flex-1 flex flex-col items-center justify-start overflow-hidden">
        <div ref={contentRef} className="w-full max-w-full animate-fadeIn transition-all duration-300">
          <div className="space-y-6 md:space-y-10">
            {Array.from({ 
              length: (Object.values(safeSlide.content!) as (string[] | undefined)[]).reduce((max: number, arr) => Math.max(max, arr?.length || 0), 0)
            }).map((_, pIdx) => (
              <div key={`p-row-${pIdx}`} className="space-y-2">
                {activePrimary.length > 0 && (
                  <div className="grid w-full items-start" style={getGridStyle(activePrimary)}>
                    {activePrimary.map(lang => {
                      const text = safeSlide.content![lang]?.[pIdx];
                      const isAr = lang === Language.ARABIC;
                      const isEn = lang === Language.ENGLISH;
                      const isCop = lang === Language.COPTIC;
                      return text ? (
                        <div key={`${lang}-${pIdx}`} className={isAr ? 'text-right' : 'text-left'} dir={isAr ? 'rtl' : 'ltr'}>
                          <div className={`leading-[1.4] text-gray-100 transition-all font-normal ${isCop ? 'font-coptic tracking-tight' : isAr ? 'font-arabic' : isEn ? 'font-eb-garamond' : 'font-inter'}`}
                               style={{ fontSize: `${getScaledFontSize(lang, settings.fontSize)}px` }}>
                            {text}
                          </div>
                        </div>
                      ) : <div key={`${lang}-${pIdx}`} />;
                    })}
                  </div>
                )}

                {activeSecondary.length > 0 && (
                  <div className="grid w-full items-start" style={getGridStyle(activeSecondary)}>
                    {activeSecondary.map(lang => {
                      const text = safeSlide.content![lang]?.[pIdx];
                      const isAr = lang === Language.TRANSLITERATED_ARABIC;
                      const isEn = lang === Language.TRANSLITERATED_ENGLISH;
                      return text ? (
                        <div key={`${lang}-${pIdx}`} className={isAr ? 'text-right' : 'text-left'} dir={isAr ? 'rtl' : 'ltr'}>
                          <div className={`leading-snug transition-all italic ${isAr ? 'font-arabic' : isEn ? 'font-eb-garamond' : 'font-inter'}`}
                               style={{ 
                                 fontSize: `${getScaledFontSize(lang, settings.fontSize)}px`,
                                 color: '#f1dca7' // Lighter yellow color
                               }}>
                            {text}
                          </div>
                        </div>
                      ) : <div key={`${lang}-${pIdx}`} />;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MATCHING SLIDE INDICATOR (BOTTOM RIGHT) - HARMONIZED WITH CONTROLS */}
      <div className="fixed bottom-4 right-4 z-[80] pointer-events-none">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl pointer-events-auto flex items-center justify-center min-w-[6rem] h-[72px]">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-cinzel text-gray-600 uppercase tracking-tighter">Slide</span>
            <span className="text-lg font-cinzel gold-text font-bold leading-none">
              {safeSlide.slideIndex} <span className="opacity-20 mx-1 text-sm">/</span> {safeSlide.totalSlidesInSection}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};