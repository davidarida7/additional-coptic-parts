import { LibraryItem, Language, LiturgicalPart, LiturgySection } from '../types.ts';
import { INITIAL_DATA } from '../constants.tsx';

export class ContentService {
  private static storageKey = 'coptic_reader_library_v2';
  private static rawTextKey = 'coptic_reader_raw_text';
  private static googleDocIdKey = 'coptic_reader_google_doc_id';

  private static slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  static async getLibrary(): Promise<LibraryItem[]> {
    const cached = localStorage.getItem(this.storageKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Malformed cache, resetting to empty");
      }
    }
    return INITIAL_DATA;
  }

  static getRawText(): string {
    return localStorage.getItem(this.rawTextKey) || '';
  }

  static getGoogleDocId(): string {
    return localStorage.getItem(this.googleDocIdKey) || '';
  }

  static saveLibrary(data: LibraryItem[], rawText?: string, googleDocId?: string) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    if (rawText !== undefined) {
      localStorage.setItem(this.rawTextKey, rawText);
    }
    if (googleDocId !== undefined) {
      localStorage.setItem(this.googleDocIdKey, googleDocId);
    }
  }

  static async fetchGoogleDocContent(docId: string): Promise<string> {
    if (!docId) throw new Error("No Document ID provided");
    const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error("Google Doc Sync Error:", error);
      throw error;
    }
  }

  static parseTextToLibrary(text: string): LibraryItem[] {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const library: LibraryItem[] = [];
    
    let currentCat: LibraryItem | null = null;
    let currentBook: LibraryItem | null = null;
    let currentSection: LiturgySection | null = null;
    let currentPart: LiturgicalPart | null = null;
    let currentLang: Language | null = null;

    const startNewPart = () => {
      if (!currentSection) return;
      currentPart = {
        id: `part-${currentSection.id}-${currentSection.parts.length + 1}`,
        type: 'prayer',
        content: {}
      };
      currentSection.parts.push(currentPart);
    };

    const addContentLine = (lang: Language, lineText: string) => {
      if (!currentPart) {
        if (!currentSection) {
          if (!currentBook) {
            if (!currentCat) {
              currentCat = {
                id: 'cat-default',
                title: 'General',
                type: 'category',
                children: []
              };
              library.push(currentCat);
            }
            currentBook = {
              id: 'book-default',
              title: 'Default Book',
              type: 'book',
              sections: []
            };
            currentCat.children!.push(currentBook);
          }
          currentSection = {
            id: 'sec-default',
            title: 'Section',
            parts: []
          };
          currentBook.sections!.push(currentSection);
        }
        startNewPart();
      }

      if (currentPart) {
        if (!currentPart.content[lang]) {
          currentPart.content[lang] = [];
        }
        const cleaned = lineText.trim();
        if (cleaned) {
          currentPart.content[lang]!.push(cleaned);
        }
      }
    };

    const langTagMap: { [key: string]: Language } = {
      'EN': Language.ENGLISH,
      'COP': Language.COPTIC,
      'AR': Language.ARABIC,
      'TRAN-EN': Language.TRANSLITERATED_ENGLISH,
      'TRAN-AR': Language.TRANSLITERATED_ARABIC,
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      
      if (trimmed.startsWith('###')) {
        const title = trimmed.replace('###', '').trim();
        currentSection = { 
          id: `sec-${this.slugify(currentBook?.title || 'cat')}-${this.slugify(title)}`, 
          title, 
          parts: [] 
        };
        if (currentBook) {
          if (!currentBook.sections) currentBook.sections = [];
          currentBook.sections.push(currentSection);
        }
        startNewPart();
        currentLang = null;
      } else if (trimmed.startsWith('##')) {
        const title = trimmed.replace('##', '').trim();
        currentBook = { 
          id: `book-${this.slugify(currentCat?.title || 'root')}-${this.slugify(title)}`, 
          title, 
          type: 'book', 
          sections: [] 
        };
        if (currentCat) {
          if (!currentCat.children) currentCat.children = [];
          currentCat.children.push(currentBook);
        }
        currentSection = null;
        currentPart = null;
        currentLang = null;
      } else if (trimmed.startsWith('#')) {
        const title = trimmed.replace('#', '').trim();
        currentCat = { 
          id: `cat-${this.slugify(title)}`, 
          title, 
          type: 'category', 
          children: [] 
        };
        library.push(currentCat);
        currentBook = null;
        currentSection = null;
        currentPart = null;
        currentLang = null;
      } else if (trimmed === '---') {
        startNewPart();
        currentLang = null;
      } else {
        const tagMatch = trimmed.match(/^\[(EN|COP|AR|TRAN-EN|TRAN-AR)\]\s*:?\s*(.*)$/i);
        if (tagMatch) {
          const matchedTag = tagMatch[1].toUpperCase();
          const targetLanguage = langTagMap[matchedTag];
          if (targetLanguage) {
            currentLang = targetLanguage;
            const inlineText = tagMatch[2].trim();
            if (inlineText) {
              addContentLine(currentLang, inlineText);
            }
          }
        } else if (currentLang) {
          // Each new line under the active language is treated as an individual stanza item
          addContentLine(currentLang, trimmed);
        }
      }
    });

    return library;
  }
}