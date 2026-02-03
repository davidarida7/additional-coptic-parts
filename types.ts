
export enum Language {
  ENGLISH = 'EN',
  COPTIC = 'COP',
  ARABIC = 'AR',
  TRANSLITERATED_ENGLISH = 'TRAN-EN',
  TRANSLITERATED_ARABIC = 'TRAN-AR'
}

export interface LiturgicalPart {
  id: string;
  type: 'prayer' | 'hymn' | 'reading' | 'instruction';
  title?: {
    [key in Language]?: string;
  };
  content: {
    [key in Language]?: string[];
  };
}

export interface LiturgySection {
  id: string;
  title: string;
  parts: LiturgicalPart[];
}

export interface LibraryItem {
  id: string;
  title: string;
  type: 'category' | 'book';
  children?: LibraryItem[]; // For categories
  sections?: LiturgySection[]; // For books
}

export interface AppSettings {
  fontSize: number;
  languages: Language[];
  presentationMode: boolean;
  isFullscreen: boolean;
}
