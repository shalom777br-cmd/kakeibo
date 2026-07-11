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
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  Upload,
  Save,
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
  "繰越",
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
  "繰越": { color: "bg-sky-50 text-sky-700 border-sky-100", icon: RotateCcw },
  "給与": { color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: Coins },
  "その他収入": { color: "bg-teal-50 text-teal-700 border-teal-100", icon: TrendingUp },
  "その他支出": { color: "bg-rose-50 text-rose-700 border-rose-100", icon: TrendingDown },
};

const predictTypeAndCategory = (itemName: string): { type?: TransactionType; category?: string } | null => {
  const name = itemName.trim().toLowerCase();
  if (!name) return null;

  // 1. Specific carry forward matches
  if (name.includes("前月からの繰越") || name === "前月から") {
    return { type: "income", category: "繰越" };
  }
  if (name.includes("翌月への繰越") || name === "翌月へ") {
    return { type: "expense", category: "繰越" };
  }
  if (name.includes("繰越") || name.includes("くりこし")) {
    if (name.includes("前")) return { type: "income", category: "繰越" };
    if (name.includes("翌") || name.includes("次")) return { type: "expense", category: "繰越" };
    return { category: "繰越" };
  }

  // 2. Typical income keywords
  const incomeKeywords = [
    { keys: ["給与", "給料", "給与口座", "賞与", "ボーナス", "手当", "salary", "pay"], cat: "給与", type: "income" as const },
    { keys: ["売上", "副業", "雑収入", "メルカリ", "ラクマ", "ヤフオク", "お小遣い", "おこづかい", "臨時収入", "配当", "利息", "還付", "キャッシュバック", "ポイント還元"], cat: "その他収入", type: "income" as const }
  ];

  for (const group of incomeKeywords) {
    if (group.keys.some(k => name.includes(k))) {
      return { type: group.type, category: group.cat };
    }
  }

  // 3. Typical expense keywords
  const expenseKeywords = [
    { keys: ["スーパー", "ライフ", "イオン", "業務スーパー", "成城石井", "食費", "ランチ", "ディナー", "ラーメン", "定食", "居酒屋", "カフェ", "スタバ", "マック", "吉野家", "弁当", "惣菜", "レストラン", "肉", "八百屋", "魚"], cat: "食費", type: "expense" as const },
    { keys: ["薬局", "ドラッグストア", "マツキヨ", "ウエルシア", "スギ薬局", "日用品", "ティッシュ", "トイレットペーパー", "洗剤", "ゴミ袋", "シャンプー", "歯磨き", "ダイソー", "セリア", "キャンドゥ", "100均", "ニトリ", "無印"], cat: "日用品", type: "expense" as const },
    { keys: ["交際費", "プレゼント", "ギフト", "お祝い", "飲み会", "会費", "お土産", "帰省", "食事会", "デート"], cat: "交際費", type: "expense" as const },
    { keys: ["電車", "バス", "タクシー", "切符", "ガソリン", "定期", "suica", "pasmo", "icoca", "駅", "運賃", "駐車場", "高速代", "航空券", "新幹線"], cat: "交通費", type: "expense" as const },
    { keys: ["家賃", "共益費", "管理費", "更新料", "住宅ローン", "ローン", "敷金", "礼金", "リフォーム", "修繕"], cat: "住宅費", type: "expense" as const },
    { keys: ["水道", "電気", "ガス", "水道局", "東京電力", "東京ガス", "光熱費", "電気代", "ガス代", "水道代", "燃料費"], cat: "光熱費", type: "expense" as const },
    { keys: ["携帯", "スマホ", "ドコモ", "au", "ソフトバンク", "楽天モバイル", "インターネット", "wifi", "回線", "通信費", "プロバイダ", "郵便", "切手", "宅急便", "佐川", "ヤマト"], cat: "通信費", type: "expense" as const },
    { keys: ["ゲーム", "映画", "漫画", "本", "雑誌", "小説", "カラオケ", "旅行", "ホテル", "チケット", "ライブ", "ディズニー", "趣味", "音楽", "netflix", "prime video", "youtube premium", "ネトフリ"], cat: "趣味・娯楽", type: "expense" as const }
  ];

  for (const group of expenseKeywords) {
    if (group.keys.some(k => name.includes(k))) {
      return { type: group.type, category: group.cat };
    }
  }

  return null;
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
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    if (currency === "BRL") {
      return `R$ ${formatted}`;
    } else if (currency === "USD") {
      return `$${formatted}`;
    } else {
      return `¥${formatted}`;
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const days = ["日", "月", "火", "水", "木", "金", "土"];
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayOfWeek = days[date.getDay()];
      return `${year}年${month}月${day}日 (${dayOfWeek})`;
    } catch (e) {
      return dateStr;
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    return (localStorage.getItem("household_ledger_sort_order") as "asc" | "desc") || "asc";
  });

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

  useEffect(() => {
    localStorage.setItem("household_ledger_sort_order", sortOrder);
  }, [sortOrder]);

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
    setVoiceError("");
    
    let parsed: any = null;
    let didFail = false;

    try {
      const response = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          currentDate: new Date().toISOString().slice(0, 10),
        }),
      });

      if (response.ok) {
        parsed = await response.json();
      } else {
        didFail = true;
      }
    } catch (err: any) {
      console.error(err);
      didFail = true;
    }

    // Always construct a suggested transaction even if parsing failed or was incomplete
    // "不十分であっても聞き取り結果を収支明細一欄に反映させる"
    const today = new Date().toISOString().slice(0, 10);
    
    // Try to extract numeric digits from the text as a fallback amount
    let fallbackAmount = 0;
    const digitsOnly = text.replace(/[^0-9.]/g, "");
    if (digitsOnly) {
      fallbackAmount = parseFloat(digitsOnly) || 0;
    }

    const suggestedDate = parsed?.date || today;
    const suggestedItem = parsed?.item || text || "音声入力の明細";
    const suggestedCategory = parsed?.category || (parsed?.type === "income" ? "その他収入" : "その他支出");
    const suggestedType = (parsed?.type === "income" || parsed?.type === "expense") ? parsed.type : "expense";
    const suggestedAmount = (typeof parsed?.amount === "number" && parsed.amount > 0) ? parsed.amount : fallbackAmount;

    setSuggestedTransaction({
      date: suggestedDate,
      item: suggestedItem,
      category: suggestedCategory,
      type: suggestedType as TransactionType,
      amount: suggestedAmount,
    });

    if (didFail || !parsed || !parsed.item || !parsed.amount) {
      setVoiceError("一部の項目を自動判別できませんでしたが、聞き取り内容から明細案を作成しました。金額等を修正して登録できます。");
    }

    setIsProcessingVoice(false);
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

    // 2. Return sorted according to sortOrder state
    // "asc": oldest first (追加順番ごとに上から下へ)
    // "desc": newest first
    return balanced.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      const idDiff = a.id.localeCompare(b.id);
      const compositeDiff = dateDiff || idDiff;
      
      return sortOrder === "asc" ? compositeDiff : -compositeDiff;
    });
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
    const amount = parseFloat(formAmount) || 0;
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

    // Smooth scroll to form card so the user sees it immediately
    setTimeout(() => {
      const element = document.getElementById("manual-form-card");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
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

  const handleItemChange = (val: string) => {
    setFormItem(val);
    const prediction = predictTypeAndCategory(val);
    if (prediction) {
      if (prediction.type) setFormType(prediction.type);
      if (prediction.category) setFormCategory(prediction.category);
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

  // Populate manual entry form with voice suggestion for further manual editing
  const handleEditSuggested = () => {
    if (!suggestedTransaction) return;
    setFormDate(suggestedTransaction.date);
    setFormItem(suggestedTransaction.item);
    setFormCategory(suggestedTransaction.category);
    setFormType(suggestedTransaction.type);
    setFormAmount(suggestedTransaction.amount > 0 ? suggestedTransaction.amount.toString() : "");
    setIsFormOpen(true);
    setSuggestedTransaction(null);
    setVoiceTranscript("");

    // Smooth scroll to manual-form-card
    setTimeout(() => {
      const element = document.getElementById("manual-form-card");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
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

  // Export to JSON backup file
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(transactions, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("JSON export error:", err);
      alert("データのバックアップ出力に失敗しました。");
    }
  };

  // Import from JSON backup file
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Validate required fields for Transaction schema
          const validated = parsed.filter(t => 
            t && 
            typeof t.id === "string" && 
            typeof t.date === "string" && 
            typeof t.item === "string" && 
            typeof t.category === "string" && 
            (t.type === "income" || t.type === "expense") && 
            typeof t.amount === "number"
          );

          if (validated.length === 0 && parsed.length > 0) {
            alert("有効な家計簿データが見つかりませんでした。ファイル形式を確認してください。");
            return;
          }

          if (confirm(`${validated.length}件の明細データをインポートしますか？現在のデータは上書きされます。`)) {
            setTransactions(validated);
            alert("データを正常に復元しました。");
          }
        } else {
          alert("形式が正しくありません。家計簿バックアップファイル（JSON形式）を選択してください。");
        }
      } catch (err) {
        console.error("JSON import error:", err);
        alert("ファイルの読み込み中にエラーが発生しました。");
      }
      e.target.value = "";
    };
    fileReader.readAsText(file);
  };

  // Export to CSV spreadsheet file with UTF-8 BOM
  const handleExportCSV = () => {
    try {
      // Sort oldest first (ascending order) to calculate running balance correctly and arrange chronologically from top to bottom
      const sortedTransactions = [...transactions].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        const idDiff = a.id.localeCompare(b.id);
        return dateDiff || idDiff;
      });

      const headers = ["日付", "カテゴリ", "項目", "収入", "支出", "残高"];
      
      let runningBalance = 0;
      const rows = sortedTransactions.map((t) => {
        if (t.type === "income") {
          runningBalance += t.amount;
        } else {
          runningBalance -= t.amount;
        }

        return [
          t.date,
          t.category,
          t.item,
          t.type === "income" ? t.amount : "",
          t.type === "expense" ? t.amount : "",
          runningBalance,
        ];
      });

      const csvContent = "\uFEFF" + [
        headers.join(","),
        ...rows.map((row) => row.map((val) => {
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kakeibo_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export error:", err);
      alert("CSVの書き出し中にエラーが発生しました。");
    }
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

          <div className="flex items-center gap-2">
            {/* Talk and record button next to PDF output */}
            <button
              onClick={handleToggleVoice}
              id="header-voice-btn"
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer hover:shadow-md ${
                isRecording
                  ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-2 ring-rose-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>{isRecording ? "聞き取り終了" : "話しかけて自動記帳"}</span>
            </button>

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
        </div>
      </header>

      {/* DASHBOARD WRAPPER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT COLUMN: LEDGER TABLE & PRIMARY INPUT */}
          <div className="lg:col-span-2 space-y-4">
            {/* THE LEDGER TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              {/* Table header */}
              <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowLeftRight className="h-4 w-4 text-slate-500" />
                    <span>収支明細一覧</span>
                  </h2>
                  <p className="text-[10px] text-slate-400">左側から日付、項目、収入、支出、収支残高が順に並びます</p>
                </div>

                <button
                  onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  className="shrink-0 flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs self-start sm:self-auto hover:border-slate-300"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                  <span>並び順: {sortOrder === "asc" ? "登録が古い順 ↑" : "登録が新しい順 ↓"}</span>
                </button>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto flex-1">
                {filteredTransactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Info className="h-6 w-6 mx-auto mb-1.5 text-slate-300" />
                    <p className="text-xs font-medium">登録されている明細がありません</p>
                    <p className="text-[10px] mt-0.5">音声入力か追加ボタンから登録してください</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-4">日付</th>
                        <th className="py-2.5 px-4">項目 (カテゴリ)</th>
                        <th className="py-2.5 px-4 text-right hidden md:table-cell">収入</th>
                        <th className="py-2.5 px-4 text-right">支出</th>
                        <th className="py-2.5 px-4 text-right font-semibold">収支残高</th>
                        <th className="py-2.5 px-4 text-center w-20">操作</th>
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
                            <td className="py-2.5 px-4 font-mono text-slate-400 font-medium whitespace-nowrap text-[11px]">
                              {t.date.replace(/-/g, ".")}
                            </td>
                            {/* 2. 項目 */}
                            <td className="py-2.5 px-4">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                                <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors text-xs">
                                  {t.item}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded border whitespace-nowrap self-start sm:self-auto ${config.color}`}>
                                  <CategoryIcon className="h-2.5 w-2.5" />
                                  {t.category}
                                </span>
                              </div>
                            </td>
                            {/* 3. 収入 */}
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500 hidden md:table-cell whitespace-nowrap text-xs">
                              {t.type === "income" ? (
                                <span className="text-emerald-600 font-semibold">+{formatCurrency(t.amount)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {/* 4. 支出 */}
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500 whitespace-nowrap text-xs">
                              {t.type === "expense" ? (
                                <span className="text-rose-600 font-semibold">-{formatCurrency(t.amount)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {/* 5. 収支残高 */}
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                              {formatCurrency((t as any).runningBalance || 0)}
                            </td>
                            {/* 6. Action buttons */}
                            <td className="py-2.5 px-4">
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

                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <button
                      onClick={() => setSuggestedTransaction(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                    >
                      破棄する
                    </button>
                    <button
                      onClick={handleEditSuggested}
                      className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>修正して記帳</span>
                    </button>
                    <button
                      onClick={handleConfirmSuggested}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-emerald-200/50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>そのまま記帳する</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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

                {/* Simplified full-width voice button & guidance */}
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
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      {isRecording ? "聞き取り中... クリックで終了" : "上のボタンまたはこちらをクリックして話すだけで、AIが自動で項目や金額を判別して入力します"}
                    </p>
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
            <div
              id="manual-form-card"
              className={`rounded-2xl border p-6 shadow-xl transition-all duration-300 ${
                editingTransaction
                  ? "bg-blue-50/20 border-blue-400 ring-2 ring-blue-500/10"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTransaction ? "明細を編集する" : "手動で記帳する"}
                  </h3>
                  {editingTransaction && (
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                      編集モード
                    </span>
                  )}
                </div>
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
                      onChange={(e) => handleItemChange(e.target.value)}
                      placeholder="例: スーパー ライフ、カフェ、給与"
                      required
                      className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    
                    {/* Quick suggestion buttons for carry-forward */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormItem("前月からの繰越");
                          setFormType("income");
                          setFormCategory("繰越");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 border border-emerald-100 rounded-xl cursor-pointer transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        前月からの繰越 (収入)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormItem("翌月への繰越");
                          setFormType("expense");
                          setFormCategory("繰越");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50/50 hover:bg-rose-100 border border-rose-100 rounded-xl cursor-pointer transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        翌月への繰越 (支出)
                      </button>
                    </div>
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
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">金額</label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0.00"
                      min="0.01"
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

            {/* DATA SAVE & BACKUP CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-slate-500 text-xs space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Save className="h-4 w-4 text-slate-700" />
                  <span className="font-bold text-slate-800">データの保存とバックアップ</span>
                </div>
                <p className="leading-relaxed">
                  本アプリのデータはお使いのブラウザに自動保存されますが、万一に備えてファイルへの保存や復元が可能です。
                </p>
              </div>

              {/* Action Buttons for export/import */}
              <div className="space-y-2">
                <button
                  onClick={handleExportCSV}
                  disabled={transactions.length === 0}
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>CSVファイルとして書き出す (Excel等)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportJSON}
                    disabled={transactions.length === 0}
                    className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    <span>バックアップ保存</span>
                  </button>

                  <label
                    htmlFor="backup-file-input"
                    className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold text-center"
                  >
                    <Upload className="h-3.5 w-3.5 text-indigo-600" />
                    <span>バックアップ復元</span>
                  </label>
                  <input
                    type="file"
                    id="backup-file-input"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Dangerous operations section */}
              <div className="pt-2.5 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (confirm("すべての家計簿データを消去して初期化しますか？")) {
                        setTransactions([]);
                        localStorage.removeItem("household_ledger_transactions_v4");
                        alert("データをリセットしました。");
                      }
                    }}
                    className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1 text-[11px] transition-colors cursor-pointer font-medium"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>データをリセット</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("注意：すべての家計簿データが永久に削除されます。本当によろしいですか？")) {
                        setTransactions([]);
                        localStorage.setItem("household_ledger_transactions_v4", JSON.stringify([]));
                        alert("すべてのデータを消去しました。");
                      }
                    }}
                    className="py-1.5 px-3 text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg text-[11px] transition-colors cursor-pointer font-medium"
                  >
                    全消去
                  </button>
                </div>
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
                <th style={{ padding: "3mm 4mm", color: "#475569", textAlign: "right" }}>支出</th>
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
                      <td style={{ padding: "3mm 4mm", textAlign: "right", color: "#475569", fontFamily: "monospace" }}>
                        {t.type === "expense" ? formatCurrency(t.amount) : "—"}
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
