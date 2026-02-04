
import { LibraryItem, Language, LiturgicalPart, LiturgySection } from '../types';

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
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Malformed cache, resetting to empty");
      }
    }
    return [];
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
        throw new Error(`Failed to fetch document: ${response.statusText}. Ensure the doc is public.`);
      }
      return await response.text();
    } catch (error) {
      console.error("Google Doc Sync Error:", error);
      throw error;
    }
  }

  static parseTextToLibrary(text: string): LibraryItem[] {
    const trimmedText = text.trim();
    if (!trimmedText) return [];

    const lines = text.split('\n');
    const library: LibraryItem[] = [];
    
    let currentCat: LibraryItem | null = null;
    let currentBook: LibraryItem | null = null;
    let currentSection: LiturgySection | null = null;
    let currentPart: LiturgicalPart | null = null;
    let currentLang: Language | null = null;
    let partCount = 0;

    const createNewPart = () => {
      partCount++;
      currentPart = {
        id: `part-${currentSection?.id || 'root'}-${partCount}`,
        type: 'prayer',
        content: {}
      };
      if (currentSection) {
        currentSection.parts.push(currentPart);
      }
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed && !currentLang) return; 

      if (trimmed.startsWith('###')) {
        const title = trimmed.replace('###', '').trim();
        currentSection = { 
          id: `sec-${this.slugify(currentBook?.title || '')}-${this.slugify(title)}`, 
          title, 
          parts: [] 
        };
        if (currentBook) {
          if (!currentBook.sections) currentBook.sections = [];
          currentBook.sections.push(currentSection);
        }
        partCount = 0;
        createNewPart();
        currentLang = null;
      } else if (trimmed.startsWith('##')) {
        const title = trimmed.replace('##', '').trim();
        currentBook = { 
          id: `book-${this.slugify(currentCat?.title || '')}-${this.slugify(title)}`, 
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
      } else if (trimmed === '---') {
        createNewPart();
        currentLang = null;
      } 
      else if (trimmed.toUpperCase() === '[EN]') { currentLang = Language.ENGLISH; }
      else if (trimmed.toUpperCase() === '[COP]') { currentLang = Language.COPTIC; }
      else if (trimmed.toUpperCase() === '[AR]') { currentLang = Language.ARABIC; }
      else if (trimmed.toUpperCase() === '[TRAN-EN]') { currentLang = Language.TRANSLITERATED_ENGLISH; }
      else if (trimmed.toUpperCase() === '[TRAN-AR]') { currentLang = Language.TRANSLITERATED_ARABIC; }
      else if (currentLang && currentPart) {
        if (!currentPart.content[currentLang]) {
          currentPart.content[currentLang] = [];
        }
        if (trimmed) {
          currentPart.content[currentLang]!.push(trimmed);
        }
      }
    });

    return library;
  }
}
