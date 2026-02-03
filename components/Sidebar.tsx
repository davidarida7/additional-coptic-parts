
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
          w-full flex items-center py-3 px-4 transition-all rounded-lg mb-1
          ${isSelected ? 'gold-text bg-white/5 border-l-2 border-[#c5a059]' : 'text-gray-400 hover:bg-white/5'}
        `}
        style={{ paddingLeft: `${(level + 1) * 1}rem` }}
      >
        <div className="flex items-center flex-1 min-w-0">
          {hasChildren || hasSections ? (
            <span className="p-1 -ml-1 mr-1">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <BookIcon size={14} className="mr-2 opacity-50 shrink-0" />
          )}
          <span className="text-xs font-bold tracking-widest uppercase truncate">{item.title}</span>
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
              className="w-full flex items-center py-2 px-4 text-gray-500 hover:text-white transition-colors"
              style={{ paddingLeft: `${(level + 2) * 1}rem` }}
            >
              <List size={12} className="mr-2 opacity-30 shrink-0" />
              <span className="text-[10px] tracking-wider uppercase truncate">{section.title}</span>
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
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-sm font-cinzel gold-text font-bold tracking-[0.3em] uppercase">Library</h2>
        <button onClick={onToggle} className="text-gray-600 hover:text-white transition-colors p-2 -mr-2"><X size={18} /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
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

      <div className="p-4 border-t border-white/5 text-[8px] text-gray-700 font-cinzel tracking-[0.2em] text-center uppercase">
        Pull left to hide
      </div>
    </div>
  );
};
