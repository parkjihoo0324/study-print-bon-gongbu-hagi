export interface StudyData {
  originalText: string;
  summary: string;
  quiz: QuizItem[];
  keywords: string[];
  mindmap: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  answer: number; // index of correct option
}

export interface Settings {
  openaiKey: string | null;
  useGemini: boolean;
  theme: 'light' | 'dark';
  fontSize: number;
}
