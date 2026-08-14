import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { LibraryItem, Language, AppSettings } from '../types.ts';

interface ReaderProps {
  book: LibraryItem | null;
  settings: AppSettings;
  targetSectionId: string | null;
  targetPartIndex: number | null;
  onTargetReached: () => void;
  onOverflow: (overflowing: boolean) => void;
}

interface ComputedSlide {
  id: string;
  type: 'title' | 'content';
  sectionTitle: string;
  sectionId: string;
  partIndex: number;
  subSlideIndex: number;
  totalSubSlides: number;
  content?: { [key in Language]?: string[] };
  slideIndex: number;
  totalSlidesInSection: number;
}

export const Reader: React.FC<ReaderProps> = ({ 
  book, 
  settings, 
  targetSectionId, 
  targetPartIndex, 
  onTargetReached, 
  onOverflow 
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [dimensions, setDimensions] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1024, 
    height: typeof window !== 'undefined' ? window.innerHeight : 768 
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastBookIdRef = useRef<string | null>(null);
  const lastPositionRef = useRef<{ sectionId: string; partIndex: number; subSlideIndex: number; isTitle: boolean } | null>(null);

  const primaryLangs = [Language.ENGLISH, Language.COPTIC, Language.ARABIC];
  const secondaryLangs = [Language.TRANSLITERATED_ENGLISH, Language.TRANSLITERATED_ARABIC];

  // Track window and container dimensions
  useLayoutEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || window.innerWidth,
          height: containerRef.current.clientHeight || window.innerHeight
        });
      } else {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateDims);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDims);
    };
  }, []);

  /**
   * Column width footprints for balanced layout
   */
  const getLangHorizontalFootprint = (lang: Language) => {
    switch (lang) {
      case Language.COPTIC: return 2.0; 
      case Language.ARABIC: return 1.5;
      case Language.TRANSLITERATED_ARABIC: return 1.35; 
      case Language.TRANSLITERATED_ENGLISH: return 1.1;
      default: return 1.1;
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

  /**
   * Estimates the rendered pixel height of row `r` within `content`
   * based on font scale, line counts, and available horizontal column widths.
   */
  const estimateRowHeight = (
    r: number, 
    content: { [key in Language]?: string[] }, 
    currentSettings: AppSettings, 
    containerWidth: number
  ): number => {
    // Leave horizontal margin padding (px-3/px-6)
    const effectiveWidth = Math.max(280, containerWidth - 48);
    
    // Active primary languages in this part
    const slideActivePrimary = primaryLangs.filter(l => 
      currentSettings.languages.includes(l) && content[l]?.some(t => Boolean(t && t.trim()))
    );
    
    const pressure = Math.pow(currentSettings.fontSize / 22, 1.2);
    const primaryWeights = slideActivePrimary.map(l => {
      const stanzas = content[l] || [];
      const maxLen = stanzas.reduce((m, s) => Math.max(m, s ? s.length : 0), 0);
      const footprint = getLangHorizontalFootprint(l);
      return Math.max(80, maxLen * footprint * pressure);
    });
    const totalWeight = primaryWeights.reduce((a, b) => a + b, 0) || 1;

    let maxPrimaryH = 0;
    const totalGap = (slideActivePrimary.length - 1) * 16;
    const usablePrimaryW = Math.max(100, effectiveWidth - totalGap);

    slideActivePrimary.forEach((l, idx) => {
      const text = content[l]?.[r] || '';
      if (!text) return;
      
      const colPx = Math.max(80, usablePrimaryW * (primaryWeights[idx] / totalWeight));
      const scaledFont = getScaledFontSize(l, currentSettings.fontSize);
      
      let charWidthFactor = 0.44;
      let lineHeightFactor = 1.28;
      if (l === Language.COPTIC) {
        charWidthFactor = 0.48;
        lineHeightFactor = 1.30;
      } else if (l === Language.ARABIC) {
        charWidthFactor = 0.44;
        lineHeightFactor = 1.40;
      }
      
      const approxCharWidth = Math.max(5, scaledFont * charWidthFactor);
      const charsPerLine = Math.max(1, Math.floor(colPx / approxCharWidth));
      
      const words = text.split(/\s+/).filter(Boolean);
      let lines = 1;
      let currentLineLen = 0;
      words.forEach(w => {
        if (currentLineLen + w.length + 1 > charsPerLine) {
          lines++;
          currentLineLen = w.length;
        } else {
          currentLineLen += (currentLineLen === 0 ? w.length : w.length + 1);
        }
      });
      
      const colHeight = lines * (scaledFont * lineHeightFactor);
      if (colHeight > maxPrimaryH) maxPrimaryH = colHeight;
    });

    // Active secondary languages (transliterations)
    const slideActiveSecondary = secondaryLangs.filter(l => 
      currentSettings.languages.includes(l) && content[l]?.some(t => Boolean(t && t.trim()))
    );
    let maxSecondaryH = 0;
    if (slideActiveSecondary.length > 0) {
      const secColPx = (effectiveWidth - (slideActiveSecondary.length - 1) * 12) / slideActiveSecondary.length;
      slideActiveSecondary.forEach(l => {
        const text = content[l]?.[r] || '';
        if (!text) return;
        const scaledFont = getScaledFontSize(l, currentSettings.fontSize);
        const approxCharWidth = Math.max(4.5, scaledFont * 0.42);
        const charsPerLine = Math.max(1, Math.floor(secColPx / approxCharWidth));
        const words = text.split(/\s+/).filter(Boolean);
        let lines = 1;
        let currentLineLen = 0;
        words.forEach(w => {
          if (currentLineLen + w.length + 1 > charsPerLine) {
            lines++;
            currentLineLen = w.length;
          } else {
            currentLineLen += (currentLineLen === 0 ? w.length : w.length + 1);
          }
        });
        const colHeight = lines * (scaledFont * 1.25);
        if (colHeight > maxSecondaryH) maxSecondaryH = colHeight;
      });
    }

    return Math.max(28, maxPrimaryH + (maxSecondaryH > 0 ? maxSecondaryH + 6 : 0));
  };

  /**
   * Helper to split a long single row into multiple text chunks if it exceeds slide height on its own
   */
  const splitSingleRowIntoChunks = (
    content: { [key in Language]?: string[] }, 
    rowIndex: number, 
    numChunks: number
  ): { [key in Language]?: string[] }[] => {
    const chunkedList: { [key in Language]?: string[] }[] = Array.from({ length: numChunks }, () => ({}));
    
    (Object.keys(content) as Language[]).forEach(lang => {
      const fullText = content[lang]?.[rowIndex] || '';
      if (!fullText) return;
      
      const words = fullText.split(/\s+/).filter(Boolean);
      if (words.length <= numChunks) {
        chunkedList[0][lang] = [fullText];
        return;
      }
      
      const wordsPerChunk = Math.ceil(words.length / numChunks);
      for (let c = 0; c < numChunks; c++) {
        const chunkWords = words.slice(c * wordsPerChunk, (c + 1) * wordsPerChunk);
        if (chunkWords.length > 0) {
          chunkedList[c][lang] = [chunkWords.join(' ')];
        }
      }
    });

    return chunkedList.filter(c => Object.keys(c).length > 0);
  };

  /**
   * DYNAMIC OVERFLOW PAGINATION ENGINE:
   * Generates slides where text fills the full viewing area down to right above
   * the "Size" (bottom-left) and "View/Slide" (bottom-right) cards before carrying over.
   */
  const allSlides = useMemo(() => {
    if (!book || !book.sections) return [];
    const computed: ComputedSlide[] = [];
    
    // Top clearance: ~24px, Bottom clearance for Size & View cards: ~96px -> total ~120px
    const availableHeight = Math.max(160, dimensions.height - 120);

    book.sections.forEach(section => {
      const sectionSlides: ComputedSlide[] = [];

      // Section Title Slide
      const titleSlide: ComputedSlide = {
        id: `title-${section.id}`,
        type: 'title',
        sectionTitle: section.title,
        sectionId: section.id,
        partIndex: -1,
        subSlideIndex: 0,
        totalSubSlides: 1,
        slideIndex: 0,
        totalSlidesInSection: 0,
      };
      sectionSlides.push(titleSlide);

      // Section Content Parts
      section.parts.forEach((part, partIdx) => {
        const totalRows = (Object.values(part.content) as (string[] | undefined)[]).reduce(
          (max: number, arr) => Math.max(max, arr?.length || 0), 
          0
        );

        if (totalRows === 0) {
          sectionSlides.push({
            id: `content-${section.id}-${partIdx}-0`,
            type: 'content',
            sectionTitle: section.title,
            sectionId: section.id,
            partIndex: partIdx,
            subSlideIndex: 0,
            totalSubSlides: 1,
            content: part.content,
            slideIndex: 0,
            totalSlidesInSection: 0,
          });
          return;
        }

        // Pack rows into sub-slides
        const subSlidesContent: { [key in Language]?: string[] }[] = [];
        let currentSlideRows: number[] = [];
        let currentSlideH = 0;
        const rowGap = 24; // Space between rows

        for (let r = 0; r < totalRows; r++) {
          const rowH = estimateRowHeight(r, part.content, settings, dimensions.width);

          // If a single row is larger than available height by itself
          if (rowH > availableHeight) {
            // Push previous accumulated rows if any
            if (currentSlideRows.length > 0) {
              const slideContent: { [key in Language]?: string[] } = {};
              (Object.keys(part.content) as Language[]).forEach(lang => {
                slideContent[lang] = currentSlideRows
                  .map(i => part.content[lang]?.[i])
                  .filter((t): t is string => Boolean(t && t.trim()));
              });
              subSlidesContent.push(slideContent);
              currentSlideRows = [];
              currentSlideH = 0;
            }

            // Split this huge row across multiple sub-slides
            const numChunks = Math.max(2, Math.ceil(rowH / availableHeight));
            const chunks = splitSingleRowIntoChunks(part.content, r, numChunks);
            chunks.forEach(chunk => {
              subSlidesContent.push(chunk);
            });
            continue;
          }

          const addedH = currentSlideRows.length === 0 ? rowH : rowH + rowGap;
          if (currentSlideRows.length > 0 && currentSlideH + addedH > availableHeight) {
            // Push current slide and start a new one for overflow
            const slideContent: { [key in Language]?: string[] } = {};
            (Object.keys(part.content) as Language[]).forEach(lang => {
              slideContent[lang] = currentSlideRows
                .map(i => part.content[lang]?.[i])
                .filter((t): t is string => Boolean(t && t.trim()));
            });
            subSlidesContent.push(slideContent);
            currentSlideRows = [r];
            currentSlideH = rowH;
          } else {
            currentSlideRows.push(r);
            currentSlideH += addedH;
          }
        }

        if (currentSlideRows.length > 0) {
          const slideContent: { [key in Language]?: string[] } = {};
          (Object.keys(part.content) as Language[]).forEach(lang => {
            slideContent[lang] = currentSlideRows
              .map(i => part.content[lang]?.[i])
              .filter((t): t is string => Boolean(t && t.trim()));
          });
          subSlidesContent.push(slideContent);
        }

        // Add sub-slides to sectionSlides
        const totalSubSlides = Math.max(1, subSlidesContent.length);
        subSlidesContent.forEach((subContent, subIdx) => {
          sectionSlides.push({
            id: `content-${section.id}-${partIdx}-${subIdx}`,
            type: 'content',
            sectionTitle: section.title,
            sectionId: section.id,
            partIndex: partIdx,
            subSlideIndex: subIdx,
            totalSubSlides,
            content: subContent,
            slideIndex: 0,
            totalSlidesInSection: 0,
          });
        });
      });

      // Update slideIndex and totalSlidesInSection
      const contentSlidesCount = sectionSlides.filter(s => s.type === 'content').length;
      let contentIndexCounter = 1;

      sectionSlides.forEach(slide => {
        slide.totalSlidesInSection = contentSlidesCount;
        if (slide.type === 'content') {
          slide.slideIndex = contentIndexCounter++;
        } else {
          slide.slideIndex = 0;
        }
        computed.push(slide);
      });
    });

    return computed;
  }, [book, settings, dimensions]);

  // Preserve user position across font size / layout recalculations
  useEffect(() => {
    if (allSlides.length === 0) return;

    if (lastPositionRef.current) {
      const { sectionId, partIndex, subSlideIndex, isTitle } = lastPositionRef.current;
      let targetIdx = -1;
      if (isTitle) {
        targetIdx = allSlides.findIndex(s => s.sectionId === sectionId && s.type === 'title');
      } else {
        targetIdx = allSlides.findIndex(s => 
          s.sectionId === sectionId && 
          s.partIndex === partIndex && 
          s.subSlideIndex === subSlideIndex
        );
        if (targetIdx === -1) {
          targetIdx = allSlides.findIndex(s => 
            s.sectionId === sectionId && 
            s.partIndex === partIndex
          );
        }
        if (targetIdx === -1) {
          targetIdx = allSlides.findIndex(s => s.sectionId === sectionId);
        }
      }

      if (targetIdx !== -1 && targetIdx !== currentSlideIndex) {
        setCurrentSlideIndex(targetIdx);
        return;
      }
    }

    if (currentSlideIndex >= allSlides.length) {
      setCurrentSlideIndex(Math.max(0, allSlides.length - 1));
    }
  }, [allSlides]);

  const safeSlide = allSlides[currentSlideIndex] || null;

  // Record active slide identity
  useEffect(() => {
    if (safeSlide) {
      lastPositionRef.current = {
        sectionId: safeSlide.sectionId,
        partIndex: safeSlide.partIndex,
        subSlideIndex: safeSlide.subSlideIndex,
        isTitle: safeSlide.type === 'title'
      };
    }
  }, [safeSlide]);

  /**
   * Keyboard Navigation (Left, Right, Space, PageUp, PageDown)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentSlideIndex(prev => Math.min(allSlides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlideIndex(Math.max(0, allSlides.length - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allSlides.length]);

  /**
   * Dynamic column width calculations for active primary languages
   */
  const currentColumnWidths = useMemo(() => {
    if (!safeSlide || safeSlide.type === 'title') return {};
    
    const slideActivePrimary = primaryLangs.filter(l => 
      settings.languages.includes(l) && 
      safeSlide.content?.[l]?.some(text => text && text.trim())
    );

    const pressure = Math.pow(settings.fontSize / 22, 1.2);

    const primaryWeights = slideActivePrimary.map(l => {
      const stanzas = safeSlide.content?.[l] || [];
      const maxStanzaLength = stanzas.reduce((max, s) => Math.max(max, s ? s.length : 0), 0);
      const footprint = getLangHorizontalFootprint(l);
      return Math.max(80, maxStanzaLength * footprint * pressure);
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
      safeSlide.content?.[lang]?.some(p => p && p.trim() !== '')
    );
  }, [safeSlide, settings.languages]);

  const activeSecondary = useMemo(() => {
    if (!safeSlide || safeSlide.type === 'title') return [];
    return secondaryLangs.filter(lang => 
      settings.languages.includes(lang) && 
      safeSlide.content?.[lang]?.some(p => p && p.trim() !== '')
    );
  }, [safeSlide, settings.languages]);

  const getGridStyle = (langs: Language[]) => {
    if (langs.length <= 1 || !safeSlide) return { gridTemplateColumns: '1fr' };
    const frs = langs.map(l => currentColumnWidths[l] || '1fr').join(' ');
    return { gridTemplateColumns: frs, gap: '1rem' }; 
  };

  useLayoutEffect(() => {
    // Only report overflow if user reached maximum size 72
    onOverflow(settings.fontSize >= 72);
  }, [settings.fontSize, onOverflow]);

  // Target navigation from search or sidebar
  useLayoutEffect(() => {
    if (!book || allSlides.length === 0) return;
    const bookChanged = lastBookIdRef.current !== book.id;
    
    if (targetSectionId) {
      let idx = -1;
      if (targetPartIndex !== null) {
        idx = allSlides.findIndex(s => 
          s.sectionId === targetSectionId && 
          s.type === 'content' && 
          s.partIndex === targetPartIndex
        );
      }
      
      if (idx === -1) {
        idx = allSlides.findIndex(s => s.sectionId === targetSectionId);
      }

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
  }, [book?.id, targetSectionId, targetPartIndex, allSlides, onTargetReached]);

  const handleNav = (e: React.MouseEvent) => {
    const { clientX, currentTarget } = e;
    const { width } = currentTarget.getBoundingClientRect();
    if (clientX < width / 3) {
      setCurrentSlideIndex(prev => Math.max(0, prev - 1));
    } else {
      setCurrentSlideIndex(prev => Math.min(allSlides.length - 1, prev + 1));
    }
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
    const LATIN = "[a-zA-Z0-9.,!?;:]";
    const ARABIC = "[\u0600-\u06FF]";
    const COPTIC = "[\u2C80-\u2CFF\u0370-\u03FF]";

    const titleParts = safeSlide.sectionTitle
      .split(/[/|]|\n/)
      .flatMap(p => {
        const boundaryRegex = new RegExp(
          `(?<=${LATIN})\\s+(?=${ARABIC}|${COPTIC})|` +
          `(?<=${ARABIC}|${COPTIC})\\s+(?=${LATIN})|` +
          `(?<=${ARABIC})\\s+(?=${COPTIC})|` +
          `(?<=${COPTIC})\\s+(?=${ARABIC})`
        );
        return p.split(boundaryRegex);
      })
      .map(p => p.trim())
      .filter(Boolean);

    return (
      <div onClick={handleNav} className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden cursor-pointer select-none items-center justify-center p-8 pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#c5a05908_0%,_transparent_70%)]" />
        <div className="max-w-5xl text-center animate-fadeIn flex flex-col gap-6 md:gap-8">
          <div className="w-24 h-[1px] bg-[#c5a059] mx-auto opacity-30" />
          {titleParts.map((part, i) => {
            const isArabic = /[\u0600-\u06FF]/.test(part);
            const isCoptic = /[\u2C80-\u2CFF\u0370-\u03FF]/.test(part);
            return (
              <h2 key={i} 
                  style={{
                    fontFamily: isCoptic 
                      ? "'FreeSerifAvvaShenouda', 'Free Serif Avva Shenouda', 'Coptic', serif" 
                      : isArabic 
                      ? "'Noto Naskh Arabic', 'Traditional Arabic', 'Times New Roman', Times, serif" 
                      : undefined
                  }}
                  className={`text-3xl md:text-6xl gold-text font-bold tracking-[0.15em] uppercase leading-tight drop-shadow-2xl ${isArabic ? 'font-arabic' : isCoptic ? 'font-coptic' : 'font-cinzel'}`}
                  dir={isArabic ? 'rtl' : 'ltr'}>
                {part}
              </h2>
            );
          })}
          <div className="w-24 h-[1px] bg-[#c5a059] mx-auto opacity-30" />
        </div>
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 opacity-20 font-cinzel text-[10px] tracking-[0.8em] gold-text uppercase animate-pulse">
          Click to proceed
        </div>
      </div>
    );
  }

  // --- RENDER CONTENT SLIDE ---
  const rowCount = (Object.values(safeSlide.content || {}) as (string[] | undefined)[]).reduce(
    (max: number, arr) => Math.max(max, arr?.length || 0), 
    0
  );

  return (
    <div 
      ref={containerRef} 
      onClick={handleNav} 
      className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden cursor-pointer select-none pt-4 px-3 md:pt-6 md:px-6 pb-28"
    >
      <div className="flex-1 flex flex-col items-center justify-start overflow-hidden">
        <div ref={contentRef} className="w-full max-w-full animate-fadeIn transition-all duration-300">
          <div className="space-y-6 md:space-y-8">
            {Array.from({ length: rowCount }).map((_, pIdx) => (
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
                          <div className={`leading-[1.35] text-gray-100 transition-all font-normal ${isCop ? 'font-coptic tracking-tight' : isAr ? 'font-arabic' : isEn ? 'font-times' : 'font-inter'}`}
                               style={{ 
                                 fontSize: `${getScaledFontSize(lang, settings.fontSize)}px`,
                                 fontFamily: isCop 
                                   ? "'FreeSerifAvvaShenouda', 'Free Serif Avva Shenouda', 'Coptic', serif" 
                                   : isAr 
                                   ? "'Noto Naskh Arabic', 'Traditional Arabic', 'Times New Roman', Times, serif" 
                                   : isEn 
                                   ? "'Times New Roman', Times, serif" 
                                   : undefined
                               }}>
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
                          <div className={`leading-snug transition-all italic ${isAr ? 'font-arabic' : isEn ? 'font-times' : 'font-inter'}`}
                               style={{ 
                                 fontSize: `${getScaledFontSize(lang, settings.fontSize)}px`,
                                 fontFamily: isAr 
                                   ? "'Noto Naskh Arabic', 'Traditional Arabic', 'Times New Roman', Times, serif" 
                                   : isEn 
                                   ? "'Times New Roman', Times, serif" 
                                   : undefined,
                                 color: '#f1dca7'
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

      {/* MATCHING SLIDE INDICATOR (BOTTOM RIGHT) - HARMONIZED WITH SIZE CARD */}
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
