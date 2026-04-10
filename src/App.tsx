/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Copy, 
  Check, 
  Settings,
  Languages,
  Sparkles,
  Info,
  BrainCircuit,
  Loader2
} from "lucide-react";
import { isCorrect, getSuggestions, autoCorrect, Suggestion } from "./lib/spellChecker";
import { GoogleGenAI } from "@google/genai";

const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

interface HistoryItem {
  id: string;
  original: string;
  corrected: string;
  timestamp: number;
  type: 'quick' | 'expert';
}

export default function App() {
  const [text, setText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [isRtl, setIsRtl] = useState(true);
  const [copied, setCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<{word: string, list: Suggestion[]} | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isQuickFixLoading, setIsQuickFixLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [mode, setMode] = useState<'check' | 'translate'>('check');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [uiLang, setUiLang] = useState<'KU' | 'EN'>('KU');
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const t = {
    KU: {
      title: "پشکنەری ڕێنووسی",
      subtitle: "کوردی",
      description: "بە پشکنەری پێشکەوتووی ڕێنووسی کاتی ڕاستەقینە و ڕاستکردنەوەی پسپۆڕی AI نووسینی کوردی خۆت پاڵاوتە بکە.",
      spellCheck: "پشکنینی ڕێنووس",
      translate: "وەرگێڕان",
      inputText: "دەقی نووسراو",
      analysis: "شیکردنەوە و ئەنجامەکان",
      aiExpert: "پسپۆڕی AI",
      quickFix: "چاککردنی خێرا",
      copyResult: "کۆپیکردنی ئەنجام",
      copied: "کۆپی کرا!",
      clear: "سڕینەوە",
      history: "مێژووی چاککردنەکان",
      info: "زانیاری",
      langSupport: "پشتیوانی زمان",
      characters: "پیت",
      words: "وشە",
      placeholder: "دەقەکەت لێرە بنووسە...",
      noHistory: "هیچ مێژوویەک نییە. دەست بکە بە چاککردنی دەق.",
      clearAll: "سڕینەوەی هەموو",
      correct: "ڕاست",
      misspelled: "هەڵە",
      status: "ئامادەیە بۆ کارکردن",
      dictionary: "فەرهەنگ: +٤٠٠٠ وشە",
      analysisPlaceholder: "ئەنجامەکان لێرە دەردەکەون کاتێک دەست دەکەیت بە نووسین..."
    },
    EN: {
      title: "Kurdish",
      subtitle: "Spell Checker",
      description: "Refine your Kurdish writing with our advanced real-time spell checker and AI expert correction.",
      spellCheck: "Spell Check",
      translate: "Translate",
      inputText: "Input Text",
      analysis: "Analysis & Results",
      aiExpert: "AI Expert",
      quickFix: "Quick Fix",
      copyResult: "Copy Result",
      copied: "Copied!",
      clear: "Clear",
      history: "Correction History",
      info: "Information",
      langSupport: "Language Support",
      characters: "characters",
      words: "words",
      placeholder: "Write your text here...",
      noHistory: "No history yet. Start correcting text to see it here.",
      clearAll: "Clear All",
      correct: "Correct",
      misspelled: "Misspelled",
      status: "Production Ready",
      dictionary: "Dictionary: 4000+ Words",
      analysisPlaceholder: "Analysis will appear here as you type..."
    }
  }[uiLang];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Detect script to set direction
  useEffect(() => {
    const arabicPattern = /[\u0600-\u06FF]/;
    if (text.length > 0) {
      setIsRtl(arabicPattern.test(text));
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const addToHistory = (original: string, corrected: string, type: 'quick' | 'expert') => {
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      original,
      corrected,
      timestamp: Date.now(),
      type
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50 items
  };

  const parseAiError = (error: any, defaultMsg: string) => {
    let msg = defaultMsg;
    try {
      // Some errors are already objects, some are JSON strings
      const errorData = typeof error.message === 'string' && error.message.includes('{') 
        ? JSON.parse(error.message) 
        : error;
        
      if (errorData.error?.message) {
        msg = errorData.error.message;
      } else if (errorData.message) {
        msg = errorData.message;
      }
      
      if (msg.includes("API key not valid") || msg.includes("INVALID_ARGUMENT")) {
        msg = "کلیلەکە (API Key) کار ناکات. تکایە لە بەشی Settings کلیلێکی ڕاست دابنێ.";
      }
    } catch {
      msg = error.message || msg;
    }
    return msg;
  };

  const handleCorrect = async () => {
    if (!text) return;
    setIsQuickFixLoading(true);
    setErrorMessage(null);
    try {
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: text,
        config: {
          systemInstruction: "Kurdish spell checker. Fix errors. Return ONLY corrected text. No explanations.",
        },
      });
      
      const resultText = response.text;
      if (resultText) {
        const result = resultText.trim();
        setCorrectedText(result);
        addToHistory(text, result, 'quick');
      } else {
        throw new Error("Empty response from AI");
      }
    } catch (error: any) {
      console.error("Quick Fix Error:", error);
      setErrorMessage(parseAiError(error, "AI Error occurred"));
      // Fallback to local correction
      const result = autoCorrect(text);
      setCorrectedText(result);
      addToHistory(text, result, 'quick');
    } finally {
      setIsQuickFixLoading(false);
    }
  };

  const handleAiRefine = async () => {
    if (!text) return;
    setIsAiLoading(true);
    setErrorMessage(null);
    setCorrectedText(""); 
    try {
      const ai = getAi();
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: text,
        config: {
          systemInstruction: `تۆ پسپۆڕی زمانی کوردی (سۆرانی). دەقەکە چاک بکە. تەنها دەقە چاککراوەکە بنێرەوە.`,
        },
      });
      
      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setCorrectedText(fullText);
        }
      }
      
      if (fullText) {
        addToHistory(text, fullText.trim(), 'expert');
      } else {
        throw new Error("Empty response from AI");
      }
    } catch (error: any) {
      console.error("AI Correction Error:", error);
      setErrorMessage(parseAiError(error, "AI Error occurred"));
      // Fallback to local correction
      const result = autoCorrect(text);
      setCorrectedText(result);
      addToHistory(text, result, 'expert');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!text) return;
    setIsTranslating(true);
    setErrorMessage(null);
    setCorrectedText("");
    try {
      const ai = getAi();
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: text,
        config: {
          systemInstruction: `You are a professional translator. Translate the input text. If the input is in Kurdish, translate it to English. If the input is in English, translate it to Kurdish Sorani. Provide ONLY the translated text.`,
        },
      });
      
      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setCorrectedText(fullText);
        }
      }
      
      if (fullText) {
        addToHistory(text, fullText.trim(), 'expert');
      } else {
        throw new Error("Empty response from AI");
      }
    } catch (error: any) {
      console.error("Translation Error:", error);
      setErrorMessage(parseAiError(error, "Translation Error occurred"));
    } finally {
      setIsTranslating(false);
    }
  };

  const useHistoryItem = (item: HistoryItem) => {
    setText(item.original);
    setCorrectedText(item.corrected);
    setShowSettings(false);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(correctedText || text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setText("");
    setCorrectedText("");
    setSuggestions(null);
  };

  const checkWord = (word: string) => {
    const cleanWord = word.replace(/[.,!?;:]/g, "");
    if (!cleanWord || cleanWord.length < 2) return true;
    return isCorrect(cleanWord);
  };

  const getWordSuggestions = (word: string) => {
    const cleanWord = word.replace(/[.,!?;:]/g, "");
    const list = getSuggestions(cleanWord);
    setSuggestions({ word: cleanWord, list });
  };

  const applySuggestion = (original: string, suggestion: string) => {
    const newText = text.replace(original, suggestion);
    setText(newText);
    setSuggestions(null);
  };

  const words = text.split(/(\s+)/);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 overflow-hidden relative">
      {/* 3D Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-orange-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[30%] bg-purple-600/10 rounded-full blur-[120px]" />
        
        {/* Grid Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} 
        />
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 md:p-2 bg-orange-500 rounded-lg shadow-lg shadow-orange-500/20">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-orange-500 font-bold">
                Hama
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-7xl font-bold tracking-tighter leading-tight md:leading-none mb-4">
              {t.title} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                {t.subtitle}
              </span>
            </h1>
            <p className="text-gray-400 max-w-md text-base md:text-lg leading-relaxed">
              {t.description}
            </p>
            {errorMessage && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}
            {!process.env.GEMINI_API_KEY && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>Gemini API Key is missing. Please add it to your environment variables.</p>
              </div>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3"
          >
            {/* Language Selector (KU/EN only) */}
            <div className="relative" ref={langDropdownRef}>
              <button 
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-sm font-bold"
              >
                {uiLang === 'KU' ? (
                  <>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Kurdistan.svg" alt="Kurdish" className="w-5 h-3 object-cover rounded-sm shadow-sm" referrerPolicy="no-referrer" />
                    <span>KU</span>
                  </>
                ) : (
                  <>
                    <img src="https://flagcdn.com/w40/gb.png" alt="English" className="w-5 h-3 object-cover rounded-sm shadow-sm" referrerPolicy="no-referrer" />
                    <span>EN</span>
                  </>
                )}
                <motion.div animate={{ rotate: showLangDropdown ? 180 : 0 }}>
                  <RotateCcw className="w-3 h-3 rotate-90" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showLangDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-40 bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <button 
                      onClick={() => { setUiLang('KU'); setShowLangDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${uiLang === 'KU' ? 'text-orange-500' : 'text-gray-400'}`}
                    >
                      <img src="https://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Kurdistan.svg" alt="Kurdish" className="w-6 h-4 object-cover rounded-sm" referrerPolicy="no-referrer" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">کوردی</span>
                        <span className="text-[10px] opacity-50 uppercase">KU</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => { setUiLang('EN'); setShowLangDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${uiLang === 'EN' ? 'text-blue-500' : 'text-gray-400'}`}
                    >
                      <img src="https://flagcdn.com/w40/gb.png" alt="English" className="w-6 h-4 object-cover rounded-sm" referrerPolicy="no-referrer" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">English</span>
                        <span className="text-[10px] opacity-50 uppercase">EN</span>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setShowInfo(!showInfo)}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors"
              title="Information"
            >
              <Info className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={() => {
                setShowSettings(!showSettings);
                setShowInfo(false);
              }}
              className={`p-3 border rounded-full transition-colors ${showSettings ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
              title="Settings & History"
            >
              <Settings className="w-5 h-5" />
            </button>
          </motion.div>
        </header>

        {/* Mode Selector */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setMode('check')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${mode === 'check' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {t.spellCheck}
          </button>
          <button 
            onClick={() => setMode('translate')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${mode === 'translate' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {t.translate}
          </button>
        </div>

        {/* Settings & History Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 p-6 bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-orange-500" />
                  {t.history}
                </h3>
                {history.length > 0 && (
                  <button 
                    onClick={clearHistory}
                    className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest"
                  >
                    {t.clearAll}
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {history.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:border-orange-500/30 transition-all group cursor-pointer"
                      onClick={() => useHistoryItem(item)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${item.type === 'expert' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                          {item.type === 'expert' ? t.aiExpert : t.quickFix}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-1 mb-1 italic">"{item.original}"</p>
                      <p className="text-sm text-white line-clamp-2 font-medium">{item.corrected}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <RotateCcw className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
                  <p className="text-gray-500 text-sm italic">{t.noHistory}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showInfo && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 p-6 bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Languages className="w-5 h-5 text-orange-500" />
                Language Support
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-400">
                <div>
                  <h4 className="text-white font-medium mb-1">Sorani (Arabic Script)</h4>
                  <p>Automatic RTL detection. Checks for common orthography mistakes like 'ه' vs 'ە' and 'ڕ' vs 'ر'.</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Kurmanji (Latin Script)</h4>
                  <p>Supports standard Kurmanji alphabet. Checks for common mistakes like 'i' vs 'î' and 'u' vs 'û'.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Interface */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              <div className="relative bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-bottom border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider text-gray-400">{t.inputText}</span>
                  </div>
                  <div className="flex items-center gap-3 md:gap-4">
                    <button 
                      onClick={() => setIsRtl(!isRtl)}
                      className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      {isRtl ? "RTL" : "LTR"}
                    </button>
                    <button 
                      onClick={handleReset}
                      className="text-gray-500 hover:text-white transition-colors"
                      title={t.clear}
                    >
                      <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
                
                <textarea
                  ref={textAreaRef}
                  value={text}
                  onChange={handleTextChange}
                  placeholder={t.placeholder}
                  dir={isRtl ? "rtl" : "ltr"}
                  className="w-full h-48 sm:h-64 md:h-80 bg-transparent p-4 md:p-8 text-base md:text-xl leading-relaxed focus:outline-none resize-none placeholder:text-gray-700"
                />

                <div className="px-4 md:px-6 py-3 md:py-4 bg-white/[0.02] border-t border-white/5 flex flex-wrap gap-2 md:gap-3 justify-between items-center">
                  <span className="text-[10px] md:text-xs text-gray-500 font-mono">
                    {text.length} {t.characters} | {text.split(/\s+/).filter(Boolean).length} {t.words}
                  </span>
                      <div className="flex gap-2">
                        {mode === 'translate' ? (
                      <button 
                        onClick={handleTranslate}
                        disabled={!text || isTranslating}
                        className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs md:text-sm font-bold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Languages className="w-3 h-3 md:w-4 md:h-4" />}
                        {t.translate}
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={handleAiRefine}
                          disabled={!text || isAiLoading}
                          className="px-3 md:px-4 py-1.5 md:py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs md:text-sm font-bold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
                        >
                          {isAiLoading ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <BrainCircuit className="w-3 h-3 md:w-4 md:h-4" />}
                          {t.aiExpert}
                        </button>
                        <button 
                          onClick={handleCorrect}
                          disabled={!text || isQuickFixLoading}
                          className="px-3 md:px-4 py-1.5 md:py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs md:text-sm font-bold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20"
                        >
                          {isQuickFixLoading ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Sparkles className="w-3 h-3 md:w-4 md:h-4" />}
                          {t.quickFix}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Analysis Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col gap-4"
          >
            <div className="relative h-full min-h-[300px]">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-500 rounded-3xl blur opacity-10"></div>
              <div className="relative h-full bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-bottom border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                    <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider text-gray-400">{t.analysis}</span>
                  </div>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" /> : <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {copied ? t.copied : t.copyResult}
                  </button>
                </div>

                <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                  {correctedText ? (
                    <div 
                      dir={isRtl ? "rtl" : "ltr"}
                      className="text-base md:text-xl leading-relaxed whitespace-pre-wrap text-orange-100"
                    >
                      {correctedText}
                    </div>
                  ) : text ? (
                    <div 
                      dir={isRtl ? "rtl" : "ltr"}
                      className="text-base md:text-xl leading-relaxed whitespace-pre-wrap"
                    >
                      {words.map((word, i) => {
                        const isMisspelled = !checkWord(word);
                        return (
                          <span 
                            key={i} 
                            onClick={() => isMisspelled && getWordSuggestions(word)}
                            className={`
                              ${isMisspelled ? "border-b-2 border-red-500/50 bg-red-500/10 cursor-pointer hover:bg-red-500/20 transition-colors" : ""}
                            `}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 py-12">
                      <Search className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-20" />
                      <p className="text-xs md:text-sm italic">{t.analysisPlaceholder}</p>
                    </div>
                  )}
                </div>

                {/* Suggestions Popover */}
                <AnimatePresence>
                  {suggestions && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-20 left-6 right-6 p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-20"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Suggestions for "{suggestions.word}"</span>
                        <button onClick={() => setSuggestions(null)} className="text-gray-500 hover:text-white">×</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.list.length > 0 ? (
                          suggestions.list.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => applySuggestion(suggestions.word, s.word)}
                              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-full transition-all"
                            >
                              {s.word}
                            </button>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500 italic">No suggestions found</span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t.correct}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t.misspelled}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Languages className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-sm text-gray-500">
              Kurdish Language Processing Unit © 2026
            </span>
          </div>
          <div className="flex items-center gap-8 text-xs font-mono text-gray-600 uppercase tracking-widest">
            <span>{t.dictionary}</span>
            <span>{t.status}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
