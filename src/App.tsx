import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  FileDown,
  Plus,
  Trash2,
  Edit3,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  Calendar,
  Tag,
  Search,
  ArrowLeftRight,
  Info,
  Coins,
  Utensils,
  ShoppingBag,
  Users,
  Train,
  Home,
  Zap,
  Phone,
  Gamepad2,
  Undo2,
} from "lucide-react";
import { Transaction, TransactionType } from "./types";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Seed data (empty by default as per user request to delete dummy transactions)
const SEED_TRANSACTIONS: Transaction[] = [];

const CATEGORIES = [
  "食費",
  "日用品",
  "交際費",
  "交通費",
  "住宅費",
  "光熱費",
  "通信費",
  "趣味・娯楽",
  "給与",
  "その他収入",
  "その他支出",
];

const categoryConfigs: Record<string, { color: string; icon: any }> = {
  "食費": { color: "bg-amber-50 text-amber-700 border-amber-100", icon: Utensils },
  "日用品": { color: "bg-blue-50 text-blue-700 border-blue-100", icon: ShoppingBag },
  "交際費": { color: "bg-pink-50 text-pink-700 border-pink-100", icon: Users },
  "交通費": { color: "bg-indigo-50 text-indigo-700 border-indigo-100", icon: Train },
  "住宅費": { color: "bg-stone-50 text-stone-700 border-stone-100", icon: Home },
  "光熱費": { color: "bg-orange-50 text-orange-700 border-orange-100", icon: Zap },
  "通信費": { color: "bg-cyan-50 text-cyan-700 border-cyan-100", icon: Phone },
  "趣味・娯楽": { color: "bg-purple-50 text-purple-700 border-purple-100", icon: Gamepad2 },
  "給与": { color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: Coins },
  "その他収入": { color: "bg-teal-50 text-teal-700 border-teal-100", icon: TrendingUp },
  "その他支出": { color: "bg-rose-50 text-rose-700 border-rose-100", icon: TrendingDown },
};

const getCategoryConfig = (cat: string) => {
  return categoryConfigs[cat] || { color: "bg-slate-50 text-slate-700 border-slate-100", icon: Tag };
};

export default function App() {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem("household_ledger_transactions_v4");
    return saved ? JSON.parse(saved) : SEED_TRANSACTIONS;
  });

  const [currency, setCurrency] = useState<"JPY" | "BRL" | "USD">(() => {
    return (localStorage.getItem("household_ledger_currency") as "JPY" | "BRL" | "USD") || "JPY";
  });

  const formatCurrency = (amount: number) => {
    if (currency === "BRL") {
      return `R$ ${amount.toLocaleString()}`;
    } else if (currency === "USD") {
      return `$${amount.toLocaleString()}`;
    } else {
      return `¥${amount.toLocaleString()}`;
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  // Form states for manual adding/editing
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Input form fields
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formItem, setFormItem] = useState("");
  const [formCategory, setFormCategory] = useState("食費");
  const [formType, setFormType] = useState<TransactionType>("expense");
  const [formAmount, setFormAmount] = useState("");

  // Voice recognition states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [suggestedTransaction, setSuggestedTransaction] = useState<Omit<Transaction, "id"> | null>(null);

  // Undo state
  const [lastDeletedTransaction, setLastDeletedTransaction] = useState<Transaction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Ref for speech recognition
  const recognitionRef = useRef<any>(null);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem("household_ledger_transactions_v4", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("household_ledger_currency", currency);
  }, [currency]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "ja-JP";

      rec.onstart = () => {
        setIsRecording(true);
        setVoiceError("");
        setVoiceTranscript("音声を聞き取っています...");
      };

      rec.onresult = async (event: any) => {
        const resultText = event.results[0][0].transcript;
        setVoiceTranscript(resultText);
        await parseTranscriptWithGemini(resultText);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setVoiceError("マイクの使用が許可されていません。ブラウザの設定をご確認ください。");
        } else {
          setVoiceError("音声認識に失敗しました。もう一度お試しください。");
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Parse voice text with Gemini
  const parseTranscriptWithGemini = async (text: string) => {
    setIsProcessingVoice(true);
    try {
      const response = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          currentDate: new Date().toISOString().slice(0, 10),
        }),
      });

      if (!response.ok) {
        let serverErrorMsg = "";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            serverErrorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(serverErrorMsg || "Gemini AI による解析に失敗しました。");
      }

      const parsed = await response.json();
      if (parsed && parsed.item && parsed.amount) {
        setSuggestedTransaction({
          date: parsed.date,
          item: parsed.item,
          category: parsed.category,
          type: parsed.type as TransactionType,
          amount: parsed.amount,
        });
      } else {
        setVoiceError("内容をうまく解釈できませんでした。もう一度はっきりお話しいただくか、手動で入力してください。");
      }
    } catch (err: any) {
      console.error(err);
      setVoiceError(err.message || "解析サーバーとの通信に失敗しました。手動でご入力ください。");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Toggle voice recording
  const handleToggleVoice = () => {
    if (!recognitionRef.current) {
      alert("お使いのブラウザは音声入力に対応していません。Google Chrome 等の対応ブラウザをお使いください。");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setSuggestedTransaction(null);
      setVoiceTranscript("");
      setVoiceError("");
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start recognition:", err);
      }
    }
  };

  // Calculate chronological running balance correctly (sorted oldest first)
  const getSortedAndBalancedTransactions = () => {
    // 1. Sort oldest first to calculate running balance
    const sortedChronological = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningBalance = 0;
    const balanced = sortedChronological.map((t) => {
      if (t.type === "income") {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }
      return {
        ...t,
        runningBalance,
      };
    });

    // 2. Return sorted newest first (or as-is, but showing newest first is standard)
    // We will do filtering next on this balanced list
    return balanced.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id));
  };

  const processedTransactions = getSortedAndBalancedTransactions();

  // Filter transactions for display
  const filteredTransactions = processedTransactions.filter((t) => {
    const matchesSearch = t.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    
    let matchesMonth = true;
    if (monthFilter !== "all") {
      const transMonth = t.date.slice(0, 7); // YYYY-MM
      matchesMonth = transMonth === monthFilter;
    }

    return matchesSearch && matchesCategory && matchesMonth;
  });

  // Unique months in data for dropdown filter
  const availableMonths = (Array.from(
    new Set(transactions.map((t) => t.date.slice(0, 7)))
  ) as string[]).sort((a, b) => b.localeCompare(a));

  // Compute overall summary stats (based on full database or filtered? Standard is full database or current view)
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = totalIncome - totalExpense;

  // Manual save (Add or Edit)
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItem.trim()) return;
    const amount = parseInt(formAmount) || 0;
    if (amount <= 0) return;

    if (editingTransaction) {
      // Edit
      setTransactions(
        transactions.map((t) =>
          t.id === editingTransaction.id
            ? {
                ...t,
                date: formDate,
                item: formItem,
                category: formCategory,
                type: formType,
                amount,
              }
            : t
        )
      );
      setEditingTransaction(null);
    } else {
      // Create
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        date: formDate,
        item: formItem,
        category: formCategory,
        type: formType,
        amount,
      };
      setTransactions([newTransaction, ...transactions]);
    }

    resetForm();
    setIsFormOpen(false);
  };

  // Open edit modal
  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setFormDate(t.date);
    setFormItem(t.item);
    setFormCategory(t.category);
    setFormType(t.type);
    setFormAmount(t.amount.toString());
    setIsFormOpen(true);
  };

  // Delete transaction
  const handleDeleteTransaction = (id: string) => {
    const toDelete = transactions.find((t) => t.id === id);
    if (toDelete) {
      setLastDeletedTransaction(toDelete);
      setTransactions(transactions.filter((t) => t.id !== id));
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
    }
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (lastDeletedTransaction) {
      setTransactions([lastDeletedTransaction, ...transactions]);
      setLastDeletedTransaction(null);
      setShowUndoToast(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormItem("");
    setFormCategory("食費");
    setFormType("expense");
    setFormAmount("");
    setEditingTransaction(null);
  };

  // Confirm and add transaction suggested by Voice AI
  const handleConfirmSuggested = () => {
    if (!suggestedTransaction) return;

    const newTrans: Transaction = {
      id: Date.now().toString(),
      ...suggestedTransaction,
    };

    setTransactions([newTrans, ...transactions]);
    setSuggestedTransaction(null);
    setVoiceTranscript("");
  };

  // Export to PDF using html2canvas & jsPDF for perfect Japanese rendering
  const handleExportPDF = async () => {
    const element = document.getElementById("pdf-printable-template");
    if (!element) return;

    // Show printable element temporarily
    element.style.display = "block";

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution crisp text rendering
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210; // A4 Width in mm
      const pdfHeight = 297; // A4 Height in mm
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`家計簿_収支明細_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("PDFの出力中にエラーが発生しました。");
    } finally {
      element.style.display = "none";
    }
  };

  // Quick preset voices simulation for demoing
  const simulateVoiceInput = async (sampleText: string) => {
    setSuggestedTransaction(null);
    setVoiceTranscript(sampleText);
    await parseTranscriptWithGemini(sampleText);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans antialiased pb-20">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h1 id="app-title" className="text-lg font-bold tracking-tight text-slate-800 leading-none">SIMPLE KAKEIBO</h1>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">シンプル家計簿</p>
            </div>
          </div>



          {/* Right: PDF Output */}
          <button
            onClick={handleExportPDF}
            id="pdf-export-button"
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow-md"
          >
            <FileDown className="h-4 w-4" />
            <span>PDF出力</span>
          </button>
        </div>
      </header>

      {/* DASHBOARD WRAPPER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT COLUMN: PRIMARY INPUT & LEDGER TABLE */}
          <div className="lg:col-span-2 space-y-4">
            {/* AI VOICE INPUT CARD */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden border border-slate-800">
              <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-5">
                <Mic className="h-24 w-24 text-blue-400" />
              </div>

              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">AI 音声入力</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 font-bold rounded border border-blue-500/20">
                    Gemini 搭載
                  </span>
                </div>

                {/* Split layout: Mic on left, Presets on right */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                  {/* Left Side: Mic Trigger & status */}
                  <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                    <button
                      onClick={handleToggleVoice}
                      className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 shadow-md cursor-pointer ${
                        isRecording
                          ? "bg-rose-600 hover:bg-rose-700 scale-105 shadow-rose-600/30 ring-4 ring-rose-500/20"
                          : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20 hover:scale-105"
                      }`}
                    >
                      {isRecording ? (
                        <MicOff className="h-4.5 w-4.5 text-white animate-pulse" />
                      ) : (
                        <Mic className="h-4.5 w-4.5 text-white" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white">話しかけて自動記帳</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {isRecording ? "聞き取り中... クリックで終了" : "クリックして話す"}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Preset Quick Buttons */}
                  <div className="flex flex-col justify-center bg-slate-950/20 p-2 rounded-xl border border-slate-800/30 gap-1">
                    <p className="text-[9px] text-slate-500 font-bold px-1 uppercase tracking-wider">お試し (クリックで即入力):</p>
                    <div className="grid grid-cols-3 md:grid-cols-1 gap-1">
                      <button
                        onClick={() => simulateVoiceInput("今日スーパーで食料品2500円買った")}
                        className="bg-slate-800/50 hover:bg-slate-700 px-1.5 py-1 rounded text-slate-300 text-[10px] text-left truncate transition-colors cursor-pointer"
                        title="今日スーパーで食料品2500円買った"
                      >
                        💬 スーパー 2500円
                      </button>
                      <button
                        onClick={() => simulateVoiceInput("昨日は友達と居酒屋で飲み会、交際費で5000円使いました")}
                        className="bg-slate-800/50 hover:bg-slate-700 px-1.5 py-1 rounded text-slate-300 text-[10px] text-left truncate transition-colors cursor-pointer"
                        title="昨日は友達と居酒屋で飲み会、交際費で5000円使いました"
                      >
                        💬 交際費 5000円
                      </button>
                      <button
                        onClick={() => simulateVoiceInput("今日アルバイトの給料が8万円入った")}
                        className="bg-slate-800/50 hover:bg-slate-700 px-1.5 py-1 rounded text-slate-300 text-[10px] text-left truncate transition-colors cursor-pointer"
                        title="今日アルバイトの給料が8万円入った"
                      >
                        💬 バイト代 8万円
                      </button>
                    </div>
                  </div>
                </div>

                {/* Transcribed live text & Suggestions */}
                <AnimatePresence mode="wait">
                  {voiceTranscript && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 backdrop-blur-sm text-xs"
                    >
                      <p className="text-[9px] text-slate-400 font-bold mb-0.5">聞き取り結果:</p>
                      <p className="text-slate-200 font-medium font-mono leading-tight">{voiceTranscript}</p>
                      
                      {isProcessingVoice && (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                          <div className="h-2.5 w-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>解析中...</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Voice Error feedback */}
                {voiceError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{voiceError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CONFIRMATION BLOCK FOR AI VOICE INPUT */}
            <AnimatePresence>
              {suggestedTransaction && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-sm">
                    <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                    <span>AI の解析に基づき自動生成された明細</span>
                  </div>

                  <div className="bg-white rounded-xl border border-emerald-200/50 p-4 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>日付</span>
                      <span className="font-mono font-medium">{suggestedTransaction.date}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span>項目</span>
                      <span className="text-slate-900">{suggestedTransaction.item}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>カテゴリ</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 font-medium text-slate-700">
                        {suggestedTransaction.category}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>収支区分</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full ${suggestedTransaction.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {suggestedTransaction.type === "income" ? "収入" : "支出"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-base font-bold">
                      <span>金額</span>
                      <span className="font-mono text-emerald-600">
                        {suggestedTransaction.type === "income" ? "+" : "-"}{formatCurrency(suggestedTransaction.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => setSuggestedTransaction(null)}
                      className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      破棄する
                    </button>
                    <button
                      onClick={handleConfirmSuggested}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-emerald-200/50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>記帳する</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THE LEDGER TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              {/* Table header / Controls */}
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-slate-500" />
                    <span>収支明細一覧</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">左側から日付、項目、収入、収支、収支残高が順に並びます</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Search query */}
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="明細・カテゴリ検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 w-full sm:w-48 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* Month filter */}
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="all">すべての月</option>
                    {availableMonths.map((m) => {
                      const [year, month] = m.split("-");
                      return (
                        <option key={m} value={m}>
                          {year}年{month}月
                        </option>
                      );
                    })}
                  </select>

                  {/* Category filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="all">全カテゴリ</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto flex-1">
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Info className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium">登録されている明細がありません</p>
                    <p className="text-xs mt-1">音声入力か追加ボタンから登録してください</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest">
                        <th className="py-4 px-8">日付</th>
                        <th className="py-4 px-8">項目 (カテゴリ)</th>
                        <th className="py-4 px-8 text-right hidden md:table-cell">収入</th>
                        <th className="py-4 px-8 text-right">収支</th>
                        <th className="py-4 px-8 text-right font-semibold">収支残高</th>
                        <th className="py-4 px-8 text-center w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredTransactions.map((t) => {
                        const config = getCategoryConfig(t.category);
                        const CategoryIcon = config.icon;
                        
                        return (
                          <tr
                            key={t.id}
                            className="hover:bg-slate-50 transition-colors group"
                          >
                            {/* 1. 日付 */}
                            <td className="py-5 px-8 font-mono text-slate-500 font-medium whitespace-nowrap">
                              {t.date.replace(/-/g, ".")}
                            </td>
                            {/* 2. 項目 */}
                            <td className="py-5 px-8">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                  {t.item}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded border ${config.color}`}>
                                    <CategoryIcon className="h-3 w-3" />
                                    {t.category}
                                  </span>
                                </div>
                              </div>
                            </td>
                            {/* 3. 収入 */}
                            <td className="py-5 px-8 text-right font-mono text-slate-500 hidden md:table-cell whitespace-nowrap">
                              {t.type === "income" ? (
                                <span className="text-emerald-600 font-semibold">+{formatCurrency(t.amount)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {/* 4. 収支 (Transaction Net) */}
                            <td className={`py-5 px-8 text-right font-mono font-bold whitespace-nowrap ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                              {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                            </td>
                            {/* 5. 収支残高 */}
                            <td className="py-5 px-8 text-right font-mono font-bold text-slate-900 text-base whitespace-nowrap">
                              {formatCurrency((t as any).runningBalance || 0)}
                            </td>
                            {/* 6. Action buttons */}
                            <td className="py-5 px-8">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(t)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                  title="編集"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SUMMARY & MANUAL CONTROLS */}
          <div className="space-y-6">
            {/* GEOMETRIC SUMMARY CARD */}
            <div className="bg-slate-900 p-6 text-white rounded-2xl border border-slate-800 shadow-xl flex flex-col divide-y divide-slate-800">
              <div className="pb-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 block font-semibold">今月の総収入</span>
                <span className="text-3xl font-mono font-bold text-emerald-400">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="py-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 block font-semibold">今月の支出</span>
                <span className="text-3xl font-mono font-bold text-slate-300">{formatCurrency(totalExpense)}</span>
              </div>
              <div className="pt-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 block font-semibold">現在の収支残高</span>
                <span className={`text-4xl font-mono font-bold ${currentBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatCurrency(currentBalance)}
                </span>
              </div>
            </div>

            {/* MANUAL TRANSACTION TRIGGERS & FORM */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">手動で記帳する</h3>
                {!isFormOpen && (
                  <button
                    onClick={() => {
                      resetForm();
                      setIsFormOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>追加</span>
                  </button>
                )}
              </div>

              {isFormOpen ? (
                <form onSubmit={handleSaveTransaction} className="space-y-4">
                  {/* Toggle income / expense */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormType("expense")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        formType === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      支出 (引き算)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("income")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        formType === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      収入 (足し算)
                    </button>
                  </div>

                  {/* Date Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">日付</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        required
                        className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Item Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">項目・店名</label>
                    <input
                      type="text"
                      value={formItem}
                      onChange={(e) => setFormItem(e.target.value)}
                      placeholder="例: スーパー ライフ、カフェ、給与"
                      required
                      className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Category Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">カテゴリ</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">金額 (円)</label>
                    <input
                      type="number"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0"
                      min="1"
                      required
                      className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setIsFormOpen(false);
                      }}
                      className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                    >
                      {editingTransaction ? "更新する" : "保存する"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                  <Plus className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-400 font-medium">追加ボタンを押すと手動入力が開きます</p>
                </div>
              )}
            </div>

            {/* CURRENCY SETTING CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-slate-500 text-xs space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Coins className="h-4 w-4 text-slate-700" />
                  <span className="font-bold text-slate-800">表示通貨設定</span>
                </div>
                <p className="leading-relaxed">
                  表示される金額の通貨単位を切り替えることができます。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                {(["JPY", "BRL", "USD"] as const).map((curr) => {
                  const label = curr === "JPY" ? "円 (¥)" : curr === "BRL" ? "レアル (R$)" : "ドル ($)";
                  return (
                    <button
                      key={curr}
                      onClick={() => setCurrency(curr)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        currency === curr
                          ? "bg-slate-900 text-white shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DEMO / RESET CARD */}
            <div className="bg-slate-100 rounded-2xl border border-slate-200 p-5 text-slate-500 text-xs flex flex-col justify-between">
              <div>
                <p className="font-bold text-slate-700 mb-1">データの保管について</p>
                <p className="leading-relaxed mb-3">
                  この家計簿は、お客様のブラウザのローカルストレージに安全に保管されます。ログイン不要で、すぐに使い始められます。
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirm("すべての家計簿データを消去して初期化しますか？")) {
                      setTransactions([]);
                      localStorage.removeItem("household_ledger_transactions_v4");
                    }
                  }}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-200 hover:text-slate-700 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer font-medium"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>データをリセット</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm("すべての家計簿データを消去して初期化しますか？")) {
                      setTransactions([]);
                      localStorage.setItem("household_ledger_transactions_v4", JSON.stringify([]));
                    }
                  }}
                  className="py-2 px-3 text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer font-medium"
                >
                  全消去
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* GEOMETRIC BALANCED FOOTER */}
        <footer className="mt-12 flex flex-col sm:flex-row justify-between items-center text-slate-400 text-xs gap-4 border-t border-slate-200 pt-6">
          <div className="flex items-center space-x-4">
            <span>© 2026 Simple Kakeibo Ltd.</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span>音声入力: 有効 (日本語)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="font-medium text-slate-500">クラウド同期完了</span>
          </div>
        </footer>
      </main>

      {/* UNDO TOAST NOTIFICATION */}
      <AnimatePresence>
        {showUndoToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 border border-slate-800 text-sm"
          >
            <span className="text-slate-300 font-medium">明細を削除しました</span>
            <button
              onClick={handleUndoDelete}
              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Undo2 className="h-4 w-4" />
              <span>取り消す</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =======================================================
          OFF-SCREEN / HIDDEN TEMPLATE FOR PRINTING PERFECT JAPANESE PDF
          Using html2canvas renders exact styling as an image so no character drops!
         ======================================================= */}
      <div
        id="pdf-printable-template"
        style={{
          display: "none",
          width: "210mm", // Standard A4 width
          minHeight: "297mm",
          padding: "20mm",
          backgroundColor: "#ffffff",
          fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
          color: "#1e293b",
        }}
      >
        {/* Invoice / PDF Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #e2e8f0", paddingBottom: "8mm", marginBottom: "8mm" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a", margin: "0 0 2mm 0" }}>収支明細報告書</h1>
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>シンプル家計簿 収支状況サマリー</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 1mm 0" }}>出力日時: {new Date().toLocaleString()}</p>
            <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>作成者: 個人家計</p>
          </div>
        </div>

        {/* Totals Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4mm", marginBottom: "8mm" }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4mm", backgroundColor: "#f8fafc" }}>
            <p style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", margin: "0 0 1mm 0" }}>総収入</p>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>{formatCurrency(totalIncome)}</h3>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4mm", backgroundColor: "#f8fafc" }}>
            <p style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", margin: "0 0 1mm 0" }}>総支出</p>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>{formatCurrency(totalExpense)}</h3>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4mm", backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <p style={{ fontSize: "10px", fontWeight: "bold", color: "#166534", textTransform: "uppercase", margin: "0 0 1mm 0" }}>差引残高</p>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", color: currentBalance >= 0 ? "#166534" : "#991b1b", margin: 0 }}>{formatCurrency(currentBalance)}</h3>
          </div>
        </div>

        {/* Main ledger list in chronological order (or same as table, newest first is fine for printing, but usually chronological oldest-first makes sense) */}
        <div>
          <h2 style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", marginBottom: "4mm" }}>明細一覧</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ padding: "3mm 4mm", color: "#475569" }}>日付</th>
                <th style={{ padding: "3mm 4mm", color: "#475569" }}>カテゴリ</th>
                <th style={{ padding: "3mm 4mm", color: "#475569" }}>項目名</th>
                <th style={{ padding: "3mm 4mm", color: "#475569", textAlign: "right" }}>収入</th>
                <th style={{ padding: "3mm 4mm", color: "#475569", textAlign: "right" }}>収支</th>
                <th style={{ padding: "3mm 4mm", color: "#475569", textAlign: "right" }}>残高</th>
              </tr>
            </thead>
            <tbody>
              {/* Show items sorted chronological (oldest-first for clean physical statement look, or same as UI) */}
              {[...transactions]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((t, idx, arr) => {
                  // Calculate running balance up to this point
                  const balanceUpToHere = arr.slice(0, idx + 1).reduce((sum, item) => {
                    return item.type === "income" ? sum + item.amount : sum - item.amount;
                  }, 0);

                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "3mm 4mm", color: "#475569", fontFamily: "monospace" }}>{t.date}</td>
                      <td style={{ padding: "3mm 4mm", fontWeight: "bold" }}>{t.category}</td>
                      <td style={{ padding: "3mm 4mm", color: "#0f172a" }}>{t.item}</td>
                      <td style={{ padding: "3mm 4mm", textAlign: "right", color: "#475569", fontFamily: "monospace" }}>
                        {t.type === "income" ? formatCurrency(t.amount) : "—"}
                      </td>
                      <td style={{ padding: "3mm 4mm", textAlign: "right", fontWeight: "bold", color: t.type === "income" ? "#166534" : "#991b1b", fontFamily: "monospace" }}>
                        {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                      </td>
                      <td style={{ padding: "3mm 4mm", textAlign: "right", fontWeight: "bold", color: "#0f172a", fontFamily: "monospace" }}>
                        {formatCurrency(balanceUpToHere)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* PDF Footer statement */}
        <div style={{ marginTop: "15mm", borderTop: "1px dashed #cbd5e1", paddingTop: "5mm", textAlign: "center" }}>
          <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>本報告書は「シンプル家計簿」Webアプリケーションから自動生成されました。</p>
        </div>
      </div>
    </div>
  );
}
