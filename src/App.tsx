import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Plus, 
  Minus, 
  BookOpen, 
  BrainCircuit, 
  Layout, 
  PenTool, 
  Share2, 
  Mic, 
  Search, 
  Youtube, 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  Trash2,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import mermaid from 'mermaid';
import { QRCodeSVG } from 'qrcode.react';
import { Whiteboard } from './components/Whiteboard';
import { StudyData, QuizItem, Settings } from './types';

// Mermaid initialization
mermaid.initialize({
  startOnLoad: true,
  theme: 'base',
  themeVariables: {
    primaryColor: '#0f172a',
    primaryTextColor: '#fff',
    lineColor: '#10b981',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#fff',
  }
});

const App: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'scan' | 'edit' | 'dashboard' | 'board'>('scan');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('study_buddy_settings');
    return saved ? JSON.parse(saved) : {
      openaiKey: '',
      useGemini: true,
      theme: 'light',
      fontSize: 16
    };
  });
  const [quizResults, setQuizResults] = useState<Record<number, number>>({});
  const [showQR, setShowQR] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Synthesis
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    window.speechSynthesis.speak(utterance);
  };

  // Effects
  useEffect(() => {
    localStorage.setItem('study_buddy_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Apply root font size for REM scaling
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
    // Ensure dark mode body class
    if (settings.theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    const savedData = localStorage.getItem('study_buddy_recent_data');
    if (savedData) setStudyData(JSON.parse(savedData));
  }, []);

  useEffect(() => {
    if (studyData?.mindmap && activeTab === 'dashboard' && mermaidRef.current) {
      mermaidRef.current.innerHTML = '';
      mermaid.render('mermaid-graph', studyData.mindmap).then(({ svg }) => {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;
          // Scale up the SVG for better visibility
          const svgElement = mermaidRef.current.querySelector('svg');
          if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = 'auto';
            svgElement.style.minHeight = '500px';
          }
        }
      });
    }
  }, [studyData, activeTab]);

  // OCR Processing
  const processImage = async (file: File) => {
    setIsLoading(true);
    setLoadingText('이미지에서 텍스트를 추출하는 중...');
    const worker = await createWorker('kor+eng');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    
    setExtractedText(text);
    setActiveTab('edit');
    setIsLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0]);
    }
  };

  // AI Analysis - Gemini Engine
  const analyzeWithAI = async () => {
    if (!extractedText.trim()) return;
    
    setIsLoading(true);
    setLoadingText('AI가 학습 데이터를 생성하고 있습니다...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        다음은 학생이 오늘 공부한 학습 프린트 내용입니다. 
        내용을 분석하여 다음의 JSON 형식으로 답변해 주세요.
        중요: 'quiz' 배열에는 반드시 정확히 5개의 문제를 생성해야 합니다.
        
        {
          "summary": "전체 내용을 3~4문장으로 핵심 요약한 내용 (한국어)",
          "quiz": [
            { "question": "문제 내용1", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 0 },
            { "question": "문제 내용2", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 1 },
            { "question": "문제 내용3", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 2 },
            { "question": "문제 내용4", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 3 },
            { "question": "문제 내용5", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 0 }
          ],
          "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
          "mindmap": "mermaid.js 문법으로 작성된 마인드맵 (예: graph TD\\n  A[주제] --> B[소주제]...)"
        }
        
        학습 데이터 내용:
        ${extractedText}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text) as StudyData;
      const finalData = { ...data, originalText: extractedText };
      setStudyData(finalData);
      localStorage.setItem('study_buddy_recent_data', JSON.stringify(finalData));
      setActiveTab('dashboard');
    } catch (error) {
      console.error(error);
      alert('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = () => setSettings(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));
  const changeFontSize = (delta: number) => setSettings(s => ({ ...s, fontSize: Math.max(12, Math.min(32, s.fontSize + delta)) }));

  const getYouTubeLink = (keyword: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword + ' 강의')}`;
  const getGoogleLink = (keyword: string) => `https://www.google.com/search?q=${encodeURIComponent(keyword + ' 뜻 개념')}`;

  return (
    <div 
      className={`min-h-screen bg-white transition-colors duration-300 dark:bg-slate-950 dark:text-slate-200`}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 h-16 bg-primary dark:bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between shadow-lg transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-primary font-black shadow-lg">
             S
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white leading-none">Study Buddy <span className="text-accent text-[10px] ml-1 opacity-80 uppercase tracking-widest font-black">v2</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3 border-r border-white/10 pr-3 sm:pr-6 group">
            <span className="hidden md:inline text-[10px] uppercase font-bold text-white/50 group-hover:text-white/80 transition-colors">Adjust Size</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => changeFontSize(-1)}
                className="p-1 hover:bg-white/10 rounded transition-colors text-white/70"
              >
                <Minus size={14} />
              </button>
              <span className="text-[10px] font-mono font-bold text-accent w-4 text-center">{settings.fontSize}</span>
              <button 
                onClick={() => changeFontSize(1)}
                className="p-1 hover:bg-white/10 rounded transition-colors text-white/70"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
              {settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button 
              onClick={() => setShowSettings(true)} 
              className="px-4 py-1.5 border border-white/20 rounded-md text-xs font-semibold text-white hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <SettingsIcon size={14} />
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-6 pb-24">
        
        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center dark:bg-slate-950/90"
            >
              <div className="p-8 text-center">
                <Loader2 size={48} className="text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-300">{loadingText}</p>
                <div className="mt-4 w-64 h-2 bg-slate-100 rounded-full overflow-hidden mx-auto dark:bg-slate-800">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="h-full w-full bg-indigo-600"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Navigation */}
        <div className="flex bg-white border border-border rounded-xl mb-8 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
          {[
            { id: 'scan', label: 'Capture & OCR', icon: Camera },
            { id: 'edit', label: 'Edit Text', icon: FileText },
            { id: 'dashboard', label: 'Summary & Quiz', icon: Layout },
            { id: 'board', label: 'Whiteboard', icon: PenTool }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.id 
                ? 'bg-slate-50 text-primary border-accent dark:bg-slate-800 dark:text-white' 
                : 'text-slate-500 border-transparent hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="min-h-[500px]">
          {/* Scan Tab */}
          {activeTab === 'scan' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-border overflow-hidden dark:bg-slate-900 dark:border-slate-800 shadow-sm"
            >
              <div className="bg-slate-50 px-4 py-3 border-b border-border flex items-center justify-between dark:bg-slate-800 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Capture & OCR</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Live</span>
                </div>
              </div>
              <div className="p-12 flex flex-col items-center">
                <div className="w-full h-64 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-white/30 border-4 border-slate-700 mb-8 relative overflow-hidden group hover:border-accent/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                   <div className="absolute top-1/2 left-0 w-full h-[2px] bg-accent/40 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                   <Camera size={48} className="group-hover:text-accent transition-colors" />
                   <span className="text-xs mt-4 uppercase font-bold tracking-widest">Viewport Ready</span>
                </div>
                
                <p className="text-slate-500 mb-8 text-center max-w-sm text-sm dark:text-slate-400">학습지를 화면에 맞추고 텍스트를 추출하세요.</p>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-12 py-4 bg-primary text-white rounded-lg font-bold text-sm tracking-wide hover:bg-slate-800 transition-all flex items-center gap-3"
                >
                  <Upload size={18} />
                  데이터 업로드
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
              </div>
            </motion.div>
          )}

          {/* Edit Tab */}
          {activeTab === 'edit' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl border border-shadow overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="bg-slate-50 px-4 py-3 border-b border-border flex items-center justify-between dark:bg-slate-800 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Extracted Text Editor</span>
                  <button onClick={() => setExtractedText('')} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors dark:hover:bg-red-900/20">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="p-6">
                  <textarea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    placeholder="콘텐츠를 입력하거나 이미지를 스캔하세요..."
                    className="w-full h-80 p-4 font-mono text-sm border border-border rounded-lg bg-slate-50 focus:ring-1 focus:ring-accent focus:border-accent outline-none dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <button 
                onClick={analyzeWithAI}
                disabled={!extractedText.trim()}
                className="w-full py-5 bg-primary text-white rounded-xl font-bold text-sm tracking-widest uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <BrainCircuit size={20} />
                Run AI 학습 분석
              </button>
            </motion.div>
          )}

          {/* Results Analysis Dashboard */}
          {activeTab === 'dashboard' && studyData && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Summary Section */}
              <section className="bg-white rounded-xl border border-border overflow-hidden dark:bg-slate-900 dark:border-slate-800 shadow-sm">
                <div className="bg-slate-50/80 px-6 py-4 flex items-center justify-between dark:bg-slate-800/50 border-b border-border">
                  <h3 className="font-bold text-primary dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                    Executive Summary
                  </h3>
                  <button onClick={() => speak(studyData.summary)} className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-tighter hover:bg-accent/5 px-2 py-1 rounded transition-colors">
                    <Mic size={14} />
                    Listen
                  </button>
                </div>
                <div className="p-8">
                  <p className="leading-relaxed text-slate-600 dark:text-slate-400 text-base">{studyData.summary}</p>
                  
                  <div className="flex flex-wrap gap-2 mt-6">
                    {studyData.keywords.map(kw => (
                      <div key={kw} className="group relative">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">
                          {kw}
                          <div className="hidden group-hover:flex absolute bottom-full left-0 mb-2 gap-1 bg-white p-1 rounded-lg shadow-xl border border-slate-100 z-10 dark:bg-slate-800">
                            <a href={getYouTubeLink(kw)} target="_blank" className="p-1 hover:bg-red-50 text-red-600"><Youtube size={14} /></a>
                            <a href={getGoogleLink(kw)} target="_blank" className="p-1 hover:bg-slate-50 text-primary"><Search size={14} /></a>
                          </div>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Mindmap Section */}
              <section className="bg-white rounded-xl border border-border dark:bg-slate-900 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-border dark:bg-slate-800/50">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    Visual Layout
                  </h3>
                </div>
                <div className="p-8 flex justify-center overflow-x-auto min-h-[300px]">
                  <div ref={mermaidRef} className="mermaid-container" />
                </div>
              </section>

              {/* Quiz Section */}
              <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-1 bg-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Test Your Knowledge</h3>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setQuizResults({})}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-primary transition-colors flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg dark:bg-slate-800"
                    >
                      <RotateCcw size={12} />
                      문제 다시 풀기
                    </button>
                    <button 
                      onClick={analyzeWithAI}
                      className="text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors flex items-center gap-1 bg-accent/5 px-3 py-1.5 rounded-lg"
                    >
                      <Plus size={12} />
                      다른 문제 생성
                    </button>
                  </div>
                </div>
                {studyData.quiz.map((q, idx) => (
                  <div key={idx} className="bg-slate-100 rounded-xl border-l-4 border-accent p-8 dark:bg-slate-900 border-border shadow-sm">
                    <p className="font-bold mb-6 text-base text-primary dark:text-white">{idx + 1}. {q.question}</p>
                    <div className="grid gap-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = quizResults[idx] === oIdx;
                        const isCorrect = oIdx === q.answer;
                        const showResult = quizResults[idx] !== undefined;

                        let style = "bg-white border-border hover:border-accent/40 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200";
                        if (showResult) {
                          if (isCorrect) style = "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300";
                          else if (isSelected) style = "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-300";
                        } else if (isSelected) {
                          style = "bg-accent/10 border-accent text-primary dark:text-accent";
                        }

                        return (
                          <button
                            key={oIdx}
                            disabled={showResult}
                            onClick={() => setQuizResults(prev => ({ ...prev, [idx]: oIdx }))}
                            className={`p-4 rounded-lg border text-sm font-medium transition-all flex items-center justify-between ${style}`}
                          >
                            <span>{opt}</span>
                            {showResult && isCorrect && <CheckCircle2 size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>

              {/* Floating Action Bar */}
              <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex gap-4 z-40">
                <button 
                  onClick={() => setShowQR(true)}
                  className="px-8 py-4 bg-primary text-white rounded-full font-bold shadow-2xl flex items-center gap-3 hover:scale-105 transition-all text-xs uppercase tracking-widest border border-white/10"
                >
                  <Share2 size={16} />
                  Share Dataset
                </button>
              </div>
            </motion.div>
          )}

          {/* Whiteboard Tab */}
          {activeTab === 'board' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[650px]">
              <Whiteboard isDark={settings.theme === 'dark'} />
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full h-8 bg-white border-t border-border flex items-center px-6 text-[10px] text-slate-400 font-bold uppercase tracking-wider justify-between z-50 dark:bg-slate-950 dark:border-slate-800">
        <div className="flex gap-4">
          <span>Storage: Auto-sync active</span>
          <span className="text-accent underline decoration-accent/30 cursor-pointer">Local Dev Env</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          Engine: Gemini-3-Flash-Preview
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-xl w-full max-w-md p-0 overflow-hidden dark:bg-slate-900 shadow-2xl border border-border"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-border flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
                <h2 className="text-xs font-bold uppercase tracking-widest">Configuration</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-lg dark:hover:bg-slate-700 text-slate-400">×</button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">OpenAI Service Key</label>
                  <input 
                    type="password"
                    value={settings.openaiKey || ''}
                    onChange={e => setSettings(s => ({ ...s, openaiKey: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-slate-50 outline-none focus:border-accent transition-colors dark:bg-slate-800 dark:border-slate-700"
                    placeholder="sk-..." 
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg dark:bg-slate-800">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Night Mode</span>
                    <span className="text-[10px] text-slate-400 font-medium tracking-tight">Switch to dark theme</span>
                  </div>
                  <div 
                    onClick={toggleTheme}
                    className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${settings.theme === 'dark' ? 'bg-accent' : 'bg-slate-300'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings.theme === 'dark' ? 'translate-x-5' : ''}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg dark:bg-slate-800">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Use Free Gemini AI</span>
                    <span className="text-[10px] text-slate-400 font-medium tracking-tight">Recommended for local dev</span>
                  </div>
                  <div 
                    onClick={() => setSettings(s => ({ ...s, useGemini: !s.useGemini }))}
                    className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${settings.useGemini ? 'bg-accent' : 'bg-slate-300'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings.useGemini ? 'translate-x-5' : ''}`} />
                  </div>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Share Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-xl w-full max-w-sm p-0 overflow-hidden dark:bg-slate-900 shadow-2xl border border-border"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-border flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
                <h2 className="text-xs font-bold uppercase tracking-widest">Share Study Set</h2>
                <button onClick={() => setShowQR(false)} className="p-2 hover:bg-slate-200 rounded-lg dark:hover:bg-slate-700 text-slate-400">×</button>
              </div>
              <div className="p-8 flex flex-col items-center">
                <div className="bg-white p-6 rounded-xl border border-border mb-6 shadow-sm overflow-hidden dark:bg-white">
                  <QRCodeSVG 
                    value={studyData?.summary.substring(0, 200) || "No data"} 
                    size={180}
                    level="L"
                    includeMargin={true}
                    fgColor="#0f172a"
                  />
                </div>
                <p className="text-center text-[11px] font-medium text-slate-500 mb-8 max-w-[220px]">Scan to view summary on mobile. (Quiz sharing coming soon)</p>
                <button 
                  onClick={() => setShowQR(false)}
                  className="w-full py-4 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-widest"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
};

export default App;
