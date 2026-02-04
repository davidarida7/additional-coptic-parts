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
  sectionTitle: string;
  sectionId: string;
  content: { [key in Language]?: string[] };
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
   * SCRIPT WEIGHT CALIBRATION (REFINED):
   * These multipliers determine horizontal width distribution.
   * Coptic characters are wide and wrap quickly; they need MORE width (1.4x) to avoid vertical stretching.
   * Arabic is concise and needs LESS width (0.75x) to maintain balance.
   */
  const getLangWeight = (lang: Language) => {
    switch (lang) {
      case Language.COPTIC: return 1.45; // High horizontal priority to prevent vertical stacking
      case Language.ARABIC: return 0.75; // Moderate priority
      case Language.TRANSLITERATED_ARABIC: return 0.85;
      case Language.TRANSLITERATED_ENGLISH: return 1.0;
      default: return 1.1; // English base (slightly boosted for EB Garamond width)
    }
  };

  /**
   * VISUAL SIZE SCALING (REFINED):
   * Fine-tuned to make Coptic look cohesive with EB Garamond.
   */
  const getScaledFontSize = (lang: Language, baseSize: number) => {
    switch (lang) {
      case Language.COPTIC: return baseSize * 1.08; // Slight boost to match EB Garamond x-height
      case Language.ARABIC: return baseSize * 1.02; // Amiri is naturally tall
      case Language.TRANSLITERATED_ARABIC: 
      case Language.TRANSLITERATED_ENGLISH: return baseSize * 0.75;
      default: return baseSize; 
    }
  };

  const allSlides = useMemo(() => {
    if (!book || !book.sections) return [];
    const computed: ComputedSlide[] = [];
    
    book.sections.forEach(section => {
      section.parts.forEach((part, partIdx) => {
        computed.push({
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
   * DYNAMIC COLUMN BALANCING (REAL-TIME REACTIVE):
   * Now explicitly tied to settings.fontSize to ensure the layout 
   * shifts properly when the user resizes text.
   */
  const currentColumnWidths = useMemo(() => {
    if (!safeSlide) return {};
    
    const slideActivePrimary = primaryLangs.filter(l => 
      settings.languages.includes(l) && 
      safeSlide.content[l]?.some(text => text.trim())
    );

    const primaryWeights = slideActivePrimary.map(l => {
      const texts = safeSlide.content[l] || [];
      const charCount = texts.join(' ').length;
      
      // We also apply a small "font scale factor" to the width math
      // Large fonts require wider columns to maintain readable lines
      const fontModifier = (settings.fontSize / 24);
      return Math.max(180, (charCount * getLangWeight(l)) * fontModifier);
    });

    const totalPrimaryWeight = primaryWeights.reduce((a, b) => a + b, 0) || 1;
    const widths: { [key: string]: string } = {};
    
    slideActivePrimary.forEach((l, i) => {
      widths[l] = `${(primaryWeights[i] / totalPrimaryWeight) * 100}fr`;
    });

    return widths;
  }, [safeSlide, settings.languages, settings.fontSize]);

  const activePrimary = useMemo(() => {
    if (!safeSlide) return [];
    return primaryLangs.filter(lang => 
      settings.languages.includes(lang) && 
      safeSlide.content[lang]?.some(p => p.trim() !== '')
    );
  }, [safeSlide, settings.languages]);

  const activeSecondary = useMemo(() => {
    if (!safeSlide) return [];
    return secondaryLangs.filter(lang => 
      settings.languages.includes(lang) && 
      safeSlide.content[lang]?.some(p => p.trim() !== '')
    );
  }, [safeSlide, settings.languages]);

  const getGridStyle = (langs: Language[]) => {
    if (langs.length <= 1 || !safeSlide) return { gridTemplateColumns: '1fr' };
    const frs = langs.map(l => currentColumnWidths[l] || '1fr').join(' ');
    return { gridTemplateColumns: frs };
  };

  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current && containerRef.current) {
        const isTooBig = contentRef.current.scrollHeight > (containerRef.current.clientHeight * 0.95);
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
            Select a book from the sidebar to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} onClick={handleNav} className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden cursor-pointer select-none">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-10">
        <div ref={contentRef} className="w-full max-w-[98vw] animate-fadeIn transition-all duration-300">
          <div className="text-center mb-8 opacity-30">
            <span className="text-[9px] md:text-xs tracking-[0.6em] gold-text uppercase font-cinzel">
              {safeSlide.sectionTitle}
            </span>
          </div>

          <div className="space-y-10 md:space-y-14">
            {Array.from({ 
              length: (Object.values(safeSlide.content) as (string[] | undefined)[]).reduce((max: number, arr) => Math.max(max, arr?.length || 0), 0)
            }).map((_, pIdx) => (
              <div key={`p-row-${pIdx}`} className="space-y-4 md:space-y-6">
                {activePrimary.length > 0 && (
                  <div className="grid gap-8 md:gap-16 w-full items-start" style={getGridStyle(activePrimary)}>
                    {activePrimary.map(lang => {
                      const text = safeSlide.content[lang]?.[pIdx];
                      const isAr = lang === Language.ARABIC;
                      const isEn = lang === Language.ENGLISH;
                      const isCop = lang === Language.COPTIC;
                      return text ? (
                        <div key={`${lang}-${pIdx}`} className={isAr ? 'text-right' : 'text-left'} dir={isAr ? 'rtl' : 'ltr'}>
                          <div className={`leading-[1.45] text-gray-100 transition-all ${isCop ? 'font-coptic tracking-tight' : isAr ? 'font-arabic' : isEn ? 'font-eb-garamond' : 'font-inter'}`}
                               style={{ fontSize: `${getScaledFontSize(lang, settings.fontSize)}px` }}>
                            {text}
                          </div>
                        </div>
                      ) : <div key={`${lang}-${pIdx}`} />;
                    })}
                  </div>
                )}

                {activeSecondary.length > 0 && (
                  <div className="grid gap-8 md:gap-16 w-full items-start" style={getGridStyle(activeSecondary)}>
                    {activeSecondary.map(lang => {
                      const text = safeSlide.content[lang]?.[pIdx];
                      const isAr = lang === Language.TRANSLITERATED_ARABIC;
                      const isEn = lang === Language.TRANSLITERATED_ENGLISH;
                      return text ? (
                        <div key={`${lang}-${pIdx}`} className={isAr ? 'text-right' : 'text-left'} dir={isAr ? 'rtl' : 'ltr'}>
                          <div className={`leading-snug gold-text opacity-50 transition-all italic ${isAr ? 'font-arabic' : isEn ? 'font-eb-garamond' : 'font-inter'}`}
                               style={{ fontSize: `${getScaledFontSize(lang, settings.fontSize)}px` }}>
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

      <div className="fixed bottom-6 right-6 z-[80] pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
          <span className="font-cinzel text-[9px] text-gray-500 tracking-widest uppercase">
            {safeSlide.slideIndex} / {safeSlide.totalSlidesInSection}
          </span>
        </div>
      </div>
    </div>
  );
};