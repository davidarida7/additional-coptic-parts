import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Reader } from './components/Reader';
import { Language, LibraryItem, AppSettings } from './types';
import { ContentService } from './services/contentService';
import { Database, Type, FileText, GripVertical, GripHorizontal, RefreshCw, Link as LinkIcon, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [googleDocId, setGoogleDocId] = useState('');
  const [isOverflowing, setIsOverflowing] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    fontSize: 24,
    languages: [
      Language.ENGLISH, 
      Language.COPTIC, 
      Language.ARABIC, 
      Language.TRANSLITERATED_ENGLISH, 
      Language.TRANSLITERATED_ARABIC
    ],
    presentationMode: true,
    isFullscreen: false
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);

  const syncFromGoogleDoc = useCallback(async (docId: string) => {
    if (!docId) return;
    setIsSyncing(true);
    try {
      const content = await ContentService.fetchGoogleDocContent(docId);
      const newLibrary = ContentService.parseTextToLibrary(content);
      ContentService.saveLibrary(newLibrary, content, docId);
      setLibrary(newLibrary);
      setEditorContent(content);
      return true;
    } catch (err) {
      alert("Failed to sync from Google Doc. Please check the ID and ensure the document is shared as 'Anyone with the link can view'.");
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const storedDocId = ContentService.getGoogleDocId();
    setGoogleDocId(storedDocId);

    if (storedDocId) {
      const success = await syncFromGoogleDoc(storedDocId);
      if (!success) {
        const data = await ContentService.getLibrary();
        const raw = ContentService.getRawText();
        setLibrary(data);
        setEditorContent(raw || "");
      }
    } else {
      const data = await ContentService.getLibrary();
      const raw = ContentService.getRawText();
      setLibrary(data);
      setEditorContent(raw || "");
    }
    setLoading(false);
  }, [syncFromGoogleDoc]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleLanguage = (lang: Language) => {
    setSettings(prev => {
      const isSelected = prev.languages.includes(lang);
      if (isSelected && prev.languages.length === 1) return prev;
      return {
        ...prev,
        languages: isSelected 
          ? prev.languages.filter(l => l !== lang)
          : [...prev.languages, lang]
      };
    });
  };

  const handleSaveEditor = () => {
    try {
      const newLibrary = ContentService.parseTextToLibrary(editorContent);
      ContentService.saveLibrary(newLibrary, editorContent, googleDocId);
      setLibrary(newLibrary);
      setIsEditorOpen(false);
    } catch (e) {
      alert("Error saving data. Please check your text formatting.");
    }
  };

  const findBook = (items: LibraryItem[], id: string): LibraryItem | null => {
    for (const item of items) {
      if (item.id === id && item.type === 'book') return item;
      if (item.children) {
        const found = findBook(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedBook = findBook(library, selectedBookId);

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-t-2 border-[#c5a059] border-r-2 border-transparent rounded-full animate-spin"></div>
      <div className="gold-text font-cinzel text-lg tracking-[0.2em] uppercase">Loading Library</div>
    </div>
  );

  const sidebarWidth = 320;
  const headerHeight = 80;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white selection:bg-[#c5a059] selection:text-black">
      
      {/* BACKGROUND READER */}
      <Reader 
        book={selectedBook} 
        settings={settings} 
        targetSectionId={targetSectionId} 
        onTargetReached={() => setTargetSectionId(null)}
        onOverflow={setIsOverflowing}
      />

      {/* DRAGGABLE SIDEBAR PANEL */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -sidebarWidth, right: 0 }}
        dragElastic={0.05}
        animate={{ x: sidebarOpen ? 0 : -sidebarWidth }}
        onDragEnd={(_, info) => {
          const shouldOpen = info.velocity.x > 20 || info.offset.x > 100;
          const shouldClose = info.velocity.x < -20 || info.offset.x < -100;
          
          if (shouldOpen) setSidebarOpen(true);
          else if (shouldClose) setSidebarOpen(false);
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 h-full z-[60] flex pointer-events-auto"
        style={{ width: sidebarWidth + 40 }}
      >
        <div className="h-full bg-[#0d0d0d]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl flex flex-col" style={{ width: sidebarWidth }}>
          <Sidebar 
            library={library} 
            selectedBookId={selectedBookId} 
            onSelectBook={(id) => { setSelectedBookId(id); setTargetSectionId(null); setSidebarOpen(false); }}
            onSelectSection={(bid, sid) => { setSelectedBookId(bid); setTargetSectionId(sid); setSidebarOpen(false); }}
            isOpen={true}
            onToggle={() => setSidebarOpen(false)}
          />
        </div>
        
        <div 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-10 h-full flex items-center justify-center cursor-pointer group bg-transparent"
        >
          <div className="w-1 h-16 bg-[#c5a059]/20 group-hover:bg-[#c5a059]/60 rounded-full transition-all flex flex-col items-center justify-center">
            <GripVertical size={12} className="text-[#c5a059] opacity-0 group-hover:opacity-100" />
          </div>
        </div>
      </motion.div>

      {/* DRAGGABLE TOP HEADER PANEL */}
      <motion.div
        drag="y"
        dragConstraints={{ top: -headerHeight, bottom: 0 }}
        dragElastic={0.05}
        animate={{ y: headerOpen ? 0 : -headerHeight }}
        onDragEnd={(_, info) => {
          const shouldOpen = info.velocity.y > 20 || info.offset.y > 40;
          const shouldClose = info.velocity.y < -20 || info.offset.y < -40;
          
          if (shouldOpen) setHeaderOpen(true);
          else if (shouldClose) setHeaderOpen(false);
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 w-full z-[70] flex flex-col pointer-events-auto items-center"
        style={{ height: headerHeight + 30 }}
      >
        <div className="w-full bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-white/10 shadow-xl flex items-center justify-between px-6" style={{ height: headerHeight }}>
          <div className="flex items-center space-x-6">
            <h1 className="font-cinzel gold-text tracking-widest font-bold text-sm hidden md:block">ADDITIONAL COPTIC PARTS</h1>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              {[Language.ENGLISH, Language.COPTIC, Language.ARABIC, Language.TRANSLITERATED_ENGLISH, Language.TRANSLITERATED_ARABIC].map(lang => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                    settings.languages.includes(lang) ? 'gold-text bg-white/5' : 'text-gray-600'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <AnimatePresence>
              {isOverflowing && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center text-[8px] text-red-500 font-bold tracking-widest uppercase mr-2"
                >
                  <AlertTriangle size={12} className="mr-1" />
                  Max Size Reached
                </motion.div>
              )}
            </AnimatePresence>

            {isSyncing && (
              <div className="flex items-center text-[10px] gold-text font-cinzel tracking-widest animate-pulse mr-4">
                <RefreshCw size={12} className="animate-spin mr-2" />
                SYNCING...
              </div>
            )}
            
            <button onClick={() => setIsEditorOpen(true)} className="p-2 text-gray-400 hover:gold-text" title="Open Database"><Database size={20} /></button>
          </div>
        </div>

        <div 
          onClick={() => setHeaderOpen(!headerOpen)}
          className="w-24 h-6 flex items-center justify-center cursor-pointer group bg-transparent"
        >
          <div className="h-1 w-12 bg-[#c5a059]/20 group-hover:bg-[#c5a059]/60 rounded-full transition-all flex items-center justify-center">
             <GripHorizontal size={12} className="text-[#c5a059] opacity-0 group-hover:opacity-100" />
          </div>
        </div>
      </motion.div>

      {/* FLOATING FONT SIZE CONTROLS (BOTTOM LEFT) */}
      <div className="fixed bottom-4 left-4 z-[80] flex items-center space-x-3 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl pointer-events-auto flex items-center space-x-3">
          <button 
            onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 2)}))} 
            className="p-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <ChevronDown size={20} />
          </button>
          <div className="flex flex-col items-center min-w-[3rem]">
            <span className="text-[10px] font-cinzel text-gray-600 uppercase tracking-tighter">Size</span>
            <span className="text-lg font-cinzel gold-text font-bold leading-none">{settings.fontSize}</span>
          </div>
          <button 
            onClick={() => setSettings(s => ({...s, fontSize: Math.min(72, s.fontSize + 2)}))} 
            disabled={isOverflowing}
            className={`p-3 rounded-xl transition-all ${isOverflowing ? 'opacity-20 cursor-not-allowed text-gray-800' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <ChevronUp size={20} />
          </button>
        </div>
      </div>

      {/* EDITOR MODAL */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col p-6 md:p-12 overflow-y-auto"
          >
            <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h2 className="text-2xl font-cinzel gold-text font-bold tracking-widest flex items-center uppercase">
                    <FileText size={24} className="mr-3" />
                    Content Editor
                  </h2>
                  <p className="text-xs text-gray-500 font-inter mt-1 tracking-wider uppercase">
                    # Category, ## Book, ### Section. [EN], [COP], [AR], [TRAN-EN], [TRAN-AR] for content. "---" for slides.
                  </p>
                </div>
                <div className="flex space-x-4 w-full md:w-auto">
                  <button onClick={() => setIsEditorOpen(false)} className="flex-1 md:flex-none px-8 py-3 border border-white/10 rounded-xl hover:bg-white/5 uppercase text-[10px] tracking-[0.2em] font-bold">Cancel</button>
                  <button onClick={handleSaveEditor} className="flex-1 md:flex-none px-8 py-3 gold-bg text-black font-bold rounded-xl hover:opacity-90 uppercase text-[10px] tracking-[0.2em] shadow-lg">Save & Close</button>
                </div>
              </div>

              {/* GOOGLE DOC SYNC BOX */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 w-full">
                  <label className="text-[10px] font-cinzel gold-text tracking-widest uppercase mb-2 block">Link to Google Doc (Public View Only)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                      <LinkIcon size={16} />
                    </div>
                    <input 
                      type="text"
                      placeholder="Enter Google Doc ID..."
                      value={googleDocId}
                      onChange={(e) => setGoogleDocId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-mono text-gray-300 focus:border-[#c5a059] outline-none transition-all"
                    />
                  </div>
                </div>
                <button 
                  disabled={!googleDocId || isSyncing}
                  onClick={() => syncFromGoogleDoc(googleDocId)}
                  className="w-full md:w-auto px-6 py-3 bg-white/5 border border-[#c5a059]/40 rounded-xl gold-text text-[10px] font-bold tracking-widest hover:bg-[#c5a059]/10 disabled:opacity-30 disabled:cursor-not-allowed uppercase flex items-center justify-center min-w-[140px]"
                >
                  {isSyncing ? (
                    <RefreshCw size={14} className="animate-spin mr-2" />
                  ) : (
                    <RefreshCw size={14} className="mr-2" />
                  )}
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>

              <textarea 
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                className="flex-1 bg-black/50 text-gray-300 font-mono p-8 rounded-2xl border border-white/10 resize-none focus:outline-none focus:border-[#c5a059] text-sm leading-relaxed shadow-inner"
                spellCheck={false}
                placeholder="# Category Name..."
                disabled={isSyncing}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(sidebarOpen || headerOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSidebarOpen(false); setHeaderOpen(false); }}
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-[2px] pointer-events-auto"
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;