import React, { useState } from 'react';
import { LibraryItem, LiturgySection } from '../types';
import { ChevronDown, ChevronRight, Book as BookIcon, X, List } from 'lucide-react';

interface SidebarProps {
  library: LibraryItem[];
  selectedBookId: string;
  onSelectBook: (id: string) => void;
  onSelectSection: (bookId: string, sectionId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Reusable script splitting logic for menu titles
const splitTitleByScript = (title: string) => {
  const LATIN = "[a-zA-Z0-9.,!?;:]";
  const ARABIC = "[\u0600-\u06FF]";
  const COPTIC = "[\u2C80-\u2CFF\u0370-\u03FF]";

  const boundaryRegex = new RegExp(
    `(?<=${LATIN})\\s+(?=${ARABIC}|${COPTIC})|` +
    `(?<=${ARABIC}|${COPTIC})\\s+(?=${LATIN})|` +
    `(?<=${ARABIC})\\s+(?=${COPTIC})|` +
    `(?<=${COPTIC})\\s+(?=${ARABIC})`
  );

  return title
    .split(/[/|]|\n/)
    .flatMap(p => p.split(boundaryRegex))
    .map(p => p.trim())
    .filter(Boolean);
};

const TitleDisplay: React.FC<{ title: string; baseClass: string }> = ({ title, baseClass }) => {
  const parts = splitTitleByScript(title);
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {parts.map((part, i) => {
        const isArabic = /[\u0600-\u06FF]/.test(part);
        const isCoptic = /[\u2C80-\u2CFF\u0370-\u03FF]/.test(part);
        return (
          <span 
            key={i} 
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`${baseClass} leading-tight break-words whitespace-normal ${
              isArabic ? 'font-arabic' : isCoptic ? 'font-coptic' : 'font-cinzel'
            }`}
          >
            {part}
          </span>
        );
      })}
    </div>
  );
};

const MenuItem: React.FC<{
  item: LibraryItem;
  level: number;
  selectedBookId: string;
  onSelect: (id: string) => void;
  onSelectSection: (bookId: string, sectionId: string) => void;
}> = ({ item, level, selectedBookId, onSelect, onSelectSection }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isBook = item.type === 'book';
  const hasChildren = item.type === 'category' && item.children && item.children.length > 0;
  const hasSections = isBook && item.sections && item.sections.length > 0;
  const isSelected = item.id === selectedBookId;

  return (
    <div className="w-full">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren || hasSections) setIsExpanded(!isExpanded);
          else onSelect(item.id);
        }}
        className={`
          w-full flex items-start py-4 px-4 transition-all rounded-lg mb-2
          ${isSelected ? 'gold-text bg-white/5 border-l-4 border-[#c5a059]' : 'text-gray-400 hover:bg-white/5'}
        `}
        style={{ paddingLeft: `${(level + 1) * 1}rem` }}
      >
        <div className="flex items-start flex-1 min-w-0">
          {hasChildren || hasSections ? (
            <span className="p-1 -ml-1 mr-2 mt-0.5 shrink-0">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          ) : (
            <BookIcon size={16} className="mr-3 mt-1 opacity-50 shrink-0" />
          )}
          <TitleDisplay 
            title={item.title} 
            baseClass="text-sm font-bold tracking-widest uppercase" 
          />
        </div>
      </button>

      {hasChildren && isExpanded && (
        <div className="mt-1">
          {item.children!.map((child) => (
            <MenuItem 
              key={child.id} 
              item={child} 
              level={level + 1} 
              selectedBookId={selectedBookId} 
              onSelect={onSelect} 
              onSelectSection={onSelectSection}
            />
          ))}
        </div>
      )}

      {hasSections && isExpanded && (
        <div className="mt-1">
          {item.sections!.map((section: LiturgySection) => (
            <button
              key={section.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSection(item.id, section.id);
              }}
              className="w-full flex items-start py-3 px-4 text-gray-500 hover:text-white transition-colors group"
              style={{ paddingLeft: `${(level + 2) * 1}rem` }}
            >
              <List size={14} className="mr-3 mt-1 opacity-30 shrink-0 group-hover:opacity-100" />
              <TitleDisplay 
                title={section.title} 
                baseClass="text-xs tracking-wider uppercase" 
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ library, selectedBookId, onSelectBook, onSelectSection, onToggle }) => {
  return (
    <div className="flex flex-col h-full select-none">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-base font-cinzel gold-text font-bold tracking-[0.3em] uppercase">Library</h2>
        <button onClick={onToggle} className="text-gray-600 hover:text-white transition-colors p-2 -mr-2"><X size={20} /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scroll-smooth">
        {library.map((item) => (
          <MenuItem 
            key={item.id} 
            item={item} 
            level={0} 
            selectedBookId={selectedBookId} 
            onSelect={onSelectBook} 
            onSelectSection={onSelectSection}
          />
        ))}
      </div>

      <div className="p-4 border-t border-white/5 text-[9px] text-gray-700 font-cinzel tracking-[0.2em] text-center uppercase bg-black/40">
        Pull left to hide
      </div>
    </div>
  );
};