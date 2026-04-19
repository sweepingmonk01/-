import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Sword, Map as MapIcon, ShieldAlert, Zap, Clock, 
  Check, ChevronRight, Play, BookOpen, Star, 
  BrainCircuit, RefreshCw, Trophy, Beaker,
  Target, Cpu, Sliders, Lock, Flame, Camera, UploadCloud, Orbit, AlertTriangle
} from 'lucide-react';
import { auth, loginWithGoogle, logoutUser, syncUserProfile, getUserProfile, saveErrorRecord, getActiveErrors, resolveError, updateCognitiveState } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type ScreenState = 'welcome' | 'profile-setup' | 'diagnostic-loading' | 'target-setter' | 'dashboard' | 'subject-map' | 'error-book' | 'overview' | 'combat' | 'combat-feedback' | 'report' | 'dehydrator' | 'theater';

interface AIQuestionData {
  painPoint: string;
  rule: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
}

interface DehydrateResult {
  total: number;
  trashEasy: number;
  dropHard: number;
  mustDo: number;
  reasoning: string;
  mustDoIndices: string;
}

interface TheaterScript {
  sceneIntro: string;
  emotion: string;
  interactionPrompt: string;
  successScene: string;
  failureScene: string;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('welcome');
  const [timeSaved, setTimeSaved] = useState(0);
  const [targetScore, setTargetScore] = useState(115);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Profile settings state
  const [grade, setGrade] = useState('');
  const [textbooks, setTextbooks] = useState({ zh: '部编版(人教)', ma: '人教版', en: '人教PEP' });

  // Monitor auth state and load profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profile = await getUserProfile(u.uid);
        if (profile) {
          if (profile.grade) setGrade(profile.grade);
          if (profile.textbooks) setTextbooks(profile.textbooks);
          if (profile.targetScore) setTargetScore(profile.targetScore);
          if (profile.timeSaved !== undefined) setTimeSaved(profile.timeSaved);
          if (profile.cognitiveState) setCogState(profile.cognitiveState);
        }
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  const saveProfileData = async (data: any) => {
    if (user) {
      await syncUserProfile(user.uid, data);
    }
  };

  const handleTimeSavedUpdate = async (additionalTime: number) => {
    const newTime = timeSaved + additionalTime;
    setTimeSaved(newTime);
    if (user) {
      await syncUserProfile(user.uid, { timeSaved: newTime });
    }
  };

  // AI Combat State
  const [aiMode, setAiMode] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [dehydrateMode, setDehydrateMode] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [theaterMode, setTheaterMode] = useState<'idle' | 'generating' | 'playing' | 'interaction' | 'resolution'>('idle');
  const [aiData, setAiData] = useState<AIQuestionData | null>(null);
  const [dehydrateData, setDehydrateData] = useState<DehydrateResult | null>(null);
  const [theaterScript, setTheaterScript] = useState<TheaterScript | null>(null);
  const [theaterResolution, setTheaterResolution] = useState<'success' | 'failure' | null>(null);
  
  // Cognitive Engine State
  const [cogState, setCogState] = useState({ focus: 50, frustration: 0, joy: 50 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dehydrateInputRef = useRef<HTMLInputElement>(null);

  // Error Book State
  const [errorList, setErrorList] = useState<any[]>([]);

  useEffect(() => {
    if (currentScreen === 'error-book' && user) {
      loadErrors();
    }
  }, [currentScreen, user]);

  const loadErrors = async () => {
    if (!user) return;
    try {
      const errs = await getActiveErrors(user.uid);
      setErrorList(errs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadQuestion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiMode('analyzing');
    setCurrentScreen('combat');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type;
      
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing Gemini API Key");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            { inlineData: { data: base64String, mimeType } },
            { text: "You are an expert tutor. I am uploading a screenshot or photo of an exam question. Analyze it. DO NOT USE MARKDOWN IN YOUR TEXT STRING OUTPUT. ONLY USE PLAIN TEXT." }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                 painPoint: { type: Type.STRING, description: "What core concept is being tested and where do students usually fail? (e.g. '完形填空逻辑连词搭配混淆' or '二次函数极值点判断')" },
                 rule: { type: Type.STRING, description: "A punchy, one-sentence rule or mnemonic to solve it. (e.g. '遇中点，连中线。构造平行四边形或中位线定理。')" },
                 questionText: { type: Type.STRING, description: "Extract the exact question text. Ignore extraneous UI elements." },
                 options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Extract EXACTLY 4 options. If the original question has fewer or none, you MUST create 4 plausible educational options to test this understanding." },
                 correctAnswer: { type: Type.STRING, description: "The correct option text exactly matching one of the generated options." }
              },
              required: ["painPoint", "rule", "questionText", "options", "correctAnswer"]
            }
          }
        });

        if(response.text) {
          const data: AIQuestionData = JSON.parse(response.text.trim());
          setAiData(data);
          setAiMode('ready');
        } else {
           throw new Error("No text response");
        }
      } catch (err) {
        console.error("AI Analysis failed:", err);
        setAiMode('idle');
        setCurrentScreen('dashboard');
      }
    };
    reader.readAsDataURL(file);
  };

  const generateCloneQuestion = async (errorItem: any) => {
    setAiMode('analyzing');
    setCurrentScreen('combat');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `I have a student struggling with the concept "${errorItem.painPoint}". The rule they need to remember is "${errorItem.rule}". The original question was "${errorItem.questionText}". Generate a NEW, unique similar question testing the exact same rule, but with different numbers, words, or contexts. Output plain JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
               painPoint: { type: Type.STRING },
               rule: { type: Type.STRING },
               questionText: { type: Type.STRING },
               options: { type: Type.ARRAY, items: { type: Type.STRING } },
               correctAnswer: { type: Type.STRING }
            },
            required: ["painPoint", "rule", "questionText", "options", "correctAnswer"]
          }
        }
      });

      if(response.text) {
        const data: AIQuestionData = JSON.parse(response.text.trim());
        setAiData({ ...data, _errorId: errorItem.id } as any);
        setAiMode('ready');
      } else {
         throw new Error("No text response");
      }
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setAiMode('idle');
      setCurrentScreen('error-book');
    }
  };

  const generateTheaterScript = async (errorItem: any) => {
    setTheaterMode('generating');
    setCurrentScreen('theater');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");

      // Mock update to cognitive state: Focus up, frustration up due to entering difficult challenge
      const newCogState = { focus: Math.min(100, cogState.focus + 20), frustration: Math.min(100, cogState.frustration + 10), joy: cogState.joy };
      setCogState(newCogState);
      if (user) {
        await updateCognitiveState(user.uid, newCogState);
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `I need a short Manga/Interactive theater script for a student struggling with "${errorItem.painPoint}". The core rule to learn is "${errorItem.rule}".
        Output in JSON with 'sceneIntro' (setup the dramatic situation), 'emotion' (the AI sprite's emotion based on the scenario: focused, urging, protective), 'interactionPrompt' (what the student needs to drag/draw/select to save the scene), 'successScene' (what happens if correct), and 'failureScene' (what happens if wrong). Make it Cyberpunk or Sci-fi action.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
               sceneIntro: { type: Type.STRING },
               emotion: { type: Type.STRING },
               interactionPrompt: { type: Type.STRING },
               successScene: { type: Type.STRING },
               failureScene: { type: Type.STRING }
            },
            required: ["sceneIntro", "emotion", "interactionPrompt", "successScene", "failureScene"]
          }
        }
      });

      if(response.text) {
        const script: TheaterScript = JSON.parse(response.text.trim());
        setTheaterScript(script);
        setTheaterMode('playing');
        
        // Auto-progress to interaction after 4 seconds of "video"
        setTimeout(() => {
          setTheaterMode('interaction');
        }, 4000);
      } else {
         throw new Error("No text response");
      }
    } catch (err) {
      console.error("Script gen failed:", err);
      setTheaterMode('idle');
      setCurrentScreen('error-book');
    }
  };

  const handleDehydrateHomework = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDehydrateMode('analyzing');
    setCurrentScreen('dehydrator');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type;
      
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing Gemini API Key");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            { inlineData: { data: base64String, mimeType } },
            { text: `Analyze this entire page of school homework. The student's target score is ${targetScore}/150 (They want maximum efficiency, not perfection). 
                     Count all the questions. Then categorize them with extreme prejudice:
                     1. Trash/Too Easy (They already know this, waste of time).
                     2. Drop/Too Hard (Beyond their target score ROI, skip it).
                     3. Must Do (The sweet spot for score growth).
                     Output strictly in the required JSON schema.` }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                 total: { type: Type.NUMBER },
                 trashEasy: { type: Type.NUMBER, description: "Count of useless repetitive easy questions" },
                 dropHard: { type: Type.NUMBER, description: "Count of ultra hard questions beyond target score" },
                 mustDo: { type: Type.NUMBER, description: "Count of questions worth doing" },
                 mustDoIndices: { type: Type.STRING, description: "e.g. 'Q4, Q7, Q12'" },
                 reasoning: { type: Type.STRING, description: "A highly confident, rebellious one-sentence reason why the rest is trash." }
              },
              required: ["total", "trashEasy", "dropHard", "mustDo", "mustDoIndices", "reasoning"]
            }
          }
        });

        if(response.text) {
          const data: DehydrateResult = JSON.parse(response.text.trim());
          setDehydrateData(data);
          setDehydrateMode('ready');
          
          if (data.trashEasy + data.dropHard > 0) {
            handleTimeSavedUpdate((data.trashEasy + data.dropHard) * 5); // 5 mins saved per skipped question
          }
        } else {
           throw new Error("No text response");
        }
      } catch (err) {
        console.error("Dehydrate Analysis failed:", err);
        setDehydrateMode('idle');
        setCurrentScreen('dashboard');
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Screens ---

  const renderWelcome = () => (
    <motion.div 
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col p-6 pb-12 items-center justify-center text-center overflow-hidden"
    >
      <div className="absolute top-10 left-10 text-[var(--color-primary)] opacity-20"><Zap size={64} /></div>
      <div className="absolute bottom-40 right-10 text-[var(--color-secondary)] opacity-20"><SparkleIcon size={80} /></div>
      
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto z-10">
        <motion.div 
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="bg-white border-4 border-[#1a1a2e] rounded-full w-24 h-24 flex items-center justify-center mb-8 shadow-[4px_4px_0_#1a1a2e]"
        >
          <img src="https://api.dicebear.com/7.x/bottts/svg?seed=freescore" alt="AI Mascot" className="w-16 h-16" />
        </motion.div>
        
        <h1 className="text-4xl font-display font-bold leading-tight mb-4 text-[#1a1a2e]">
          今天先拿回<br/><span className="text-[var(--color-primary)] selection-bg">最值的分。</span>
        </h1>
        
        <p className="text-lg text-gray-600 mb-12 font-medium px-4">
          系统已为你挑出最短提分路径。完成这 3 项，你就比昨天更自由。
        </p>

        <button 
          onClick={async () => {
            try {
              let currentUser = user;
              if (!currentUser) {
                const res = await loginWithGoogle();
                currentUser = res.user;
              }
              const profile = await getUserProfile(currentUser.uid);
              if (profile && profile.grade) {
                setCurrentScreen('dashboard');
              } else {
                setCurrentScreen('profile-setup');
              }
            } catch (err) {
              console.error("Login Error:", err);
            }
          }}
          className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex items-center justify-center gap-2"
        >
          <Play fill="currentColor" size={24} /> {authChecking ? '连接中...' : '建立档案并诊断'}
        </button>
        
        <button className="mt-4 font-bold text-gray-500 flex items-center gap-2 py-2 px-4 hover:bg-gray-200 rounded-full transition-colors">
          <Clock size={18} /> 看看我省回多少时间
        </button>
      </div>
    </motion.div>
  );

  const renderProfileSetup = () => (
    <motion.div 
      key="profile-setup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 p-6 z-10"
    >
      <h2 className="text-3xl font-display font-bold text-[#1a1a2e] mb-2 mt-8">建立控分档案</h2>
      <p className="text-gray-500 font-bold mb-8">我们需要你的当前学段与教材版本，以精准匹配全国真题树。</p>
      
      <div className="space-y-8 flex-1 overflow-y-auto pb-6">
        {/* 年级选择 */}
        <div>
          <h3 className="font-bold text-lg mb-3">在读年级</h3>
          <div className="grid grid-cols-3 gap-2">
            {['三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'].map(g => (
              <button 
                key={g}
                onClick={() => setGrade(g)}
                className={`py-2 px-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  grade === g 
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-[2px_2px_0_var(--color-primary)]' 
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 教材版本 */}
        <div>
          <h3 className="font-bold text-lg mb-3">三科教材版本</h3>
          <div className="space-y-3">
            {[{id: 'zh', name: '丹青语文', color: 'var(--color-subj-zh)', opts: ['部编版(人教)', '苏教版', '语文版']}, 
              {id: 'ma', name: '极光数学', color: 'var(--color-subj-ma)', opts: ['人教版', '北师大版', '苏教版']}, 
              {id: 'en', name: '阳光英语', color: 'var(--color-subj-en)', opts: ['人教PEP', '外研社', '牛津版']}].map(subj => (
              <div key={subj.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full`} style={{backgroundColor: subj.color}}></div>
                  <span className="font-bold text-[#1a1a2e]">{subj.name}</span>
                </div>
                <select 
                  className="bg-gray-50 border-2 border-gray-200 rounded-lg px-2 py-1 font-bold text-sm outline-none focus:border-[var(--color-primary)]"
                  value={textbooks[subj.id as keyof typeof textbooks]}
                  onChange={(e) => setTextbooks({...textbooks, [subj.id]: e.target.value})}
                >
                  {subj.opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        disabled={!grade}
        onClick={async () => {
          await saveProfileData({ grade, textbooks });
          setCurrentScreen('diagnostic-loading');
          setTimeout(() => setCurrentScreen('target-setter'), 3000);
        }}
        className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex justify-center items-center gap-2 mt-auto"
      >
        <MapIcon size={24} /> 开始极速诊断
      </button>
    </motion.div>
  );

  const renderDiagnosticLoading = () => (
    <motion.div 
      key="diag"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[var(--color-primary)] text-white"
    >
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <BrainCircuit size={64} />
      </motion.div>
      <h2 className="text-2xl font-display font-bold mt-6 tracking-wider">FreeScore AI 演算中</h2>
      
      <div className="mt-8 space-y-3 w-64">
        {[
          { text: "扫描本地高频考点核心库...", delay: 0 },
          { text: "比对近 3 年期末真题概率...", delay: 0.8 },
          { text: "构建最小学习成本图谱...", delay: 1.6 }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: item.delay }}
            className="flex items-center gap-2 text-sm font-bold opacity-80"
          >
            <Check size={16} /> {item.text}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderTargetSetter = () => {
    const baseScore = 85;
    const ptsNeeded = targetScore - baseScore;
    const timeNeeded = Math.max(0, Math.ceil(ptsNeeded * 1.5));
    const tasksNeeded = Math.max(0, Math.ceil(ptsNeeded / 4));

    return (
      <motion.div 
        key="target-setter"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 p-6 z-10"
      >
        <div className="flex items-center gap-2 mt-4 mb-2">
          <Sliders className="text-[var(--color-primary)]" />
          <h2 className="text-3xl font-display font-bold text-[#1a1a2e]">自由控分盘</h2>
        </div>
        <p className="text-gray-500 font-bold mb-8">AI 将为你计算达到目标分数的<span className="text-[var(--color-secondary)]">最短路径</span></p>
        
        {/* Slider Area */}
        <div className="bg-white p-6 rounded-[32px] border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] mb-8">
          <div className="flex justify-between items-end mb-6">
            <span className="text-sm font-bold text-gray-400">设置你的目标</span>
            <span className="text-5xl font-display font-bold text-[var(--color-primary)] tracking-tight">
              {targetScore}<span className="text-lg text-gray-400 ml-1">/150</span>
            </span>
          </div>
          
          <input 
            type="range" 
            min={85} 
            max={145} 
            value={targetScore} 
            onChange={(e) => setTargetScore(Number(e.target.value))}
            className="w-full appearance-none h-4 rounded-full bg-gray-200 border-2 border-[#1a1a2e] outline-none cursor-pointer"
            style={{ backgroundImage: `linear-gradient(to right, var(--color-primary) ${(targetScore - 85) / 60 * 100}%, transparent 0)` }}
          />
          
          <div className="flex justify-between mt-3 text-xs font-bold text-gray-400">
            <span>85 (当前水平)</span>
            <span>150 满分</span>
          </div>
        </div>

        {/* AI Prediction Area */}
        <div className="game-card p-5 mb-auto relative overflow-hidden bg-[#1a1a2e] text-white border-0">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Cpu size={100} /></div>
          
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <SparkleIcon className="text-[var(--color-accent-green)] w-6 h-6" />
            <h3 className="font-bold text-lg">AI 路径动态重组</h3>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-gray-400 font-medium">净提分需求</span>
              <span className="font-bold text-xl text-white">+{ptsNeeded} 分</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-gray-400 font-medium">需攻克高频考点</span>
              <motion.span 
                key={tasksNeeded} 
                initial={{ scale: 1.5, color: '#FF8A3D' }} 
                animate={{ scale: 1, color: '#FF8A3D' }} 
                className="font-bold text-2xl text-[var(--color-secondary)] inline-block"
              >
                {tasksNeeded} 个
              </motion.span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-gray-400 font-medium">预计总耗时</span>
              <motion.span 
                key={timeNeeded} 
                initial={{ scale: 1.5, color: '#33D1A0' }} 
                animate={{ scale: 1, color: '#33D1A0' }} 
                className="font-bold text-2xl text-[var(--color-accent-green)] inline-block"
              >
                {timeNeeded} 分钟
              </motion.span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium">AI 命中率预估</span>
              <span className="font-bold text-xl text-white">96.8%</span>
            </div>
          </div>
        </div>

        <button 
          onClick={async () => {
             await saveProfileData({ targetScore });
             setCurrentScreen('dashboard');
          }}
          className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex justify-center items-center gap-2 mt-6"
        >
          <MapIcon fill="currentColor" size={24} /> 生成最短提分路径
        </button>
      </motion.div>
    );
  };

  const renderDashboard = () => (
    <motion.div 
      key="dash"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 pb-24"
    >
      {/* Top Header */}
      <div className="bg-[var(--color-primary)] text-white p-6 pt-10 rounded-b-[40px] shadow-lg border-b-4 border-[#1a1a2e] relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-full border-2 border-[#1a1a2e]">
              <img src={user?.photoURL || "https://api.dicebear.com/7.x/notionists/svg?seed=Alex"} alt="Avatar" className="w-10 h-10 rounded-full" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{user ? user.displayName?.split(' ')[0] : 'Alex'} 的自由岛 {grade ? `· ${grade}` : ''}</h2>
              <p className="text-xs font-bold text-white/80">LV.12 觉醒者</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="bg-white/20 px-3 py-1 rounded-full border border-white/40 flex items-center gap-1 font-bold">
              <Clock size={16} /> 储备 {timeSaved} 分钟
            </div>
            {user && (
              <button 
                onClick={() => { logoutUser(); setCurrentScreen('welcome'); }}
                className="bg-white/20 px-3 py-1 rounded-full border border-white/40 text-xs font-bold"
              >
                登出
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1 bg-white text-[#1a1a2e] p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] flex flex-col items-center">
            <span className="text-xs font-bold text-gray-500 mb-1">当前战力</span>
            <span className="text-2xl font-display font-bold text-[var(--color-primary)]">85<span className="text-sm">/150</span></span>
          </div>
          <div className="flex-1 bg-[--color-secondary] text-[#1a1a2e] p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] flex flex-col items-center">
            <span className="text-xs font-bold text-[#1a1a2e]/90 mb-1">今日控分目标</span>
            <span className="text-2xl font-display font-bold text-[#1a1a2e]">{targetScore}<span className="text-sm"> 分</span></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto w-full max-w-lg mx-auto">
        <div className="flex justify-between items-end mb-4">
          <h3 className="font-display text-2xl font-bold flex items-center gap-2">
            <Target className="text-[var(--color-secondary)]" /> AI 定制任务
          </h3>
          <span className="text-sm font-bold text-gray-500">
            预计耗时 {Math.max(0, Math.ceil((targetScore - 85) * 1.5))} 分钟
          </span>
        </div>

        <div className="space-y-4">
          {/* Dehydrator Banner */}
          <div 
            onClick={() => dehydrateInputRef.current?.click()}
            className="game-card p-5 relative overflow-hidden flex flex-col bg-[#1a1a2e] text-white border-4 border-[var(--color-secondary)] shadow-[0_0_15px_var(--color-secondary)] cursor-pointer mb-6 transform transition-transform hover:-translate-y-1"
          >
            <input type="file" accept="image/*" ref={dehydrateInputRef} className="hidden" onChange={handleDehydrateHomework} />
            <div className="absolute top-0 right-0 p-4 opacity-20"><Zap size={100} className="text-[var(--color-secondary)]" /></div>
            
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <h3 className="font-display font-bold text-2xl text-[var(--color-secondary)]">学校作业脱水舱</h3>
              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">禁忌功能</span>
            </div>
            
            <p className="text-sm font-bold text-gray-400 mb-4 h-10 relative z-10">
              拍下老师发的整张试卷。AI 将基于你的控分目标，彻底摧毁无用题海，只留精华。
            </p>
            
            <div className="flex items-center justify-between mt-auto relative z-10">
              <span className="text-gray-400 font-bold text-xs bg-white/10 px-2 py-1 rounded-full border border-gray-600">
                Gemini 纯视觉扫描判卷
              </span>
              <button 
                className="game-btn bg-[var(--color-secondary)] text-[#1a1a2e] px-4 py-2 text-sm flex items-center gap-1 border-2 border-transparent"
              >
                <UploadCloud size={16} /> 立即脱水
              </button>
            </div>
          </div>

          {/* AI Multimodal Upload Zone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="game-card p-5 relative overflow-hidden flex flex-col bg-[var(--color-secondary)] border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] cursor-pointer mb-2 transform transition-transform hover:-translate-y-1"
          >
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleUploadQuestion} />
            <div className="absolute top-0 right-0 p-4 opacity-10"><Camera size={100} className="text-[#1a1a2e]" /></div>
            
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <div className="bg-white p-2 rounded-full border-2 border-[#1a1a2e]"><BrainCircuit size={20} className="text-[var(--color-primary)]" /></div>
              <h3 className="font-display font-bold text-xl text-[#1a1a2e]">AI 多模态拍题破解</h3>
            </div>
            
            <p className="text-sm font-bold text-[#1a1a2e]/80 mb-4 h-10 relative z-10">
              遇到不会的题？直接拍照，FreeScore Engine 将秒级重构底层知识逻辑并生成“一句话法则”。
            </p>
            
            <div className="flex items-center justify-between mt-auto relative z-10">
              <span className="text-[#1a1a2e] font-bold text-sm bg-white/40 px-2 py-1 rounded-full border-2 border-[#1a1a2e]">
                接入 Gemini 1.5 Pro
              </span>
              <button 
                className="game-btn bg-white text-[#1a1a2e] px-4 py-2 text-sm flex items-center gap-1"
              >
                <UploadCloud size={16} /> 立即上传
              </button>
            </div>
          </div>

          <div className="flex justify-between items-end mb-2 mt-6">
            <h3 className="font-display text-xl font-bold flex items-center gap-1">
              <Target size={20} className="text-[var(--color-secondary)]" /> 专属学习列车
            </h3>
          </div>

          {/* Card 1 */}
          <div className="game-card p-4 relative overflow-hidden flex flex-col">
            <div className="absolute -right-4 -top-4 bg-[var(--color-subj-ma)] w-16 h-16 rounded-full opacity-20"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="bg-[var(--color-subj-ma)] text-white text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e]">极光数学</span>
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Clock size={12}/> 5min</span>
            </div>
            <h4 className="font-bold text-lg mb-1 relative z-10">必拿分：几何辅助线</h4>
            <p className="text-sm text-gray-600 mb-4 font-medium h-10">近 3 次考试相似题丢分，只需掌握【遇中点连中线】，立刻保底 +4 分。</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-[var(--color-secondary)] font-bold text-sm flex items-center gap-1">
                <Star size={16} fill="currentColor"/> 预计收益高
              </span>
              <button 
                onClick={() => setCurrentScreen('combat')}
                className="game-btn bg-[var(--color-subj-ma)] text-white px-6 py-2 text-sm"
              >
                开始修复
              </button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="game-card p-4 relative overflow-hidden flex flex-col">
            <div className="absolute -right-4 -top-4 bg-[var(--color-subj-en)] w-16 h-16 rounded-full opacity-20"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="bg-[var(--color-subj-en)] text-[#1a1a2e] text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e]">阳光英语</span>
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Clock size={12}/> 8min</span>
            </div>
            <h4 className="font-bold text-lg mb-1 relative z-10">高危失分：完形逻辑词</h4>
            <p className="text-sm text-gray-600 mb-4 font-medium h-10">错因分析：although 与 despite 用法混淆。彻底解决防止连环扣分。</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-[var(--color-accent-pink)] font-bold text-sm flex items-center gap-1">
                <ShieldAlert size={16} /> 易错陷阱
              </span>
              <button className="game-btn bg-gray-200 text-gray-400 px-6 py-2 text-sm border-gray-400 opacity-80 cursor-not-allowed">
                锁 定
              </button>
            </div>
          </div>
          
          {/* Card 3 */}
          <div className="game-card p-4 relative overflow-hidden flex flex-col">
            <div className="absolute -right-4 -top-4 bg-[var(--color-subj-zh)] w-16 h-16 rounded-full opacity-20"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="bg-[var(--color-subj-zh)] text-white text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e]">丹青语文</span>
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Clock size={12}/> 3min</span>
            </div>
            <h4 className="font-bold text-lg mb-1 relative z-10">记忆复活：古诗默写</h4>
            <p className="text-sm text-gray-600 mb-4 font-medium h-10">《登高》距离上次复现已过 7 天，现在复习记忆保持率提升至 90%。</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-[var(--color-accent-green)] font-bold text-sm flex items-center gap-1">
                <RefreshCw size={16} /> 最佳复习期
              </span>
              <button className="game-btn bg-gray-200 text-gray-400 px-6 py-2 text-sm border-gray-400 opacity-80 cursor-not-allowed">
                锁 定
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderSubjectMap = () => (
    <motion.div 
      key="subject-map"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-[#F4F6FB] pb-24"
    >
      <div className="bg-[var(--color-subj-zh)] text-white p-6 pt-10 rounded-b-[40px] shadow-lg border-b-4 border-[#1a1a2e] relative z-10">
        <h2 className="text-2xl font-display font-bold flex items-center gap-2"><MapIcon /> 丹青语文 · 文海拾光</h2>
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          <button className="px-4 py-1 bg-white text-[var(--color-subj-zh)] font-bold rounded-full border-2 border-[#1a1a2e] text-sm whitespace-nowrap">基础塔 100%</button>
          <button className="px-4 py-1 bg-black/20 text-white font-bold rounded-full border-2 border-transparent text-sm whitespace-nowrap">宝库 35%</button>
          <button className="px-4 py-1 bg-[#1a1a2e] text-[var(--color-accent-pink)] font-bold rounded-full border-2 border-transparent text-sm whitespace-nowrap shadow-[0_0_10px_rgba(255,20,147,0.5)]">战略放弃区 (深渊)</button>
        </div>
      </div>
      <div className="flex-1 p-6 relative overflow-y-auto w-full max-w-lg mx-auto flex flex-col items-center pt-10">
        {/* Map Path Line */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 border-l-4 border-dashed border-gray-300"></div>
        
        {/* Node 4 - THE ABANDONED NODE */}
        <div className="relative z-10 flex flex-col items-center mb-12 transform translate-x-14">
          <div className="bg-[#1a1a2e] w-14 h-14 rounded-full border-4 border-gray-600 flex items-center justify-center text-[var(--color-accent-pink)] mb-2 shadow-[0_0_15px_var(--color-accent-pink)] animate-pulse">
            <Lock size={20} />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-gray-500 line-through decoration-2">文言虚词穷举</span>
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase mt-1">系统强行劝退</span>
          </div>
        </div>

        {/* Node 3 */}
        <div className="relative z-10 flex flex-col items-center mb-12">
          <div className="bg-gray-300 w-16 h-16 rounded-full border-4 border-[#1a1a2e] flex items-center justify-center text-gray-500 mb-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
            <Lock size={24} />
          </div>
          <span className="font-bold text-gray-400">词义推断</span>
        </div>

        {/* Node 2 - ACTIVE */}
        <div className="relative z-10 flex flex-col items-center mb-12 transform -translate-x-10 cursor-pointer" onClick={() => setCurrentScreen('combat')}>
          <div className="bg-[var(--color-secondary)] w-20 h-20 rounded-full border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] flex items-center justify-center text-white mb-2">
            <Flame size={32} />
          </div>
          <span className="font-bold text-[#1a1a2e] bg-white px-3 py-1 rounded-full border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]">古诗默写</span>
        </div>

        {/* Node 1 - CLEARED */}
        <div className="relative z-10 flex flex-col items-center transform translate-x-10">
          <div className="bg-[var(--color-accent-green)] w-16 h-16 rounded-full border-4 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] flex items-center justify-center text-[#1a1a2e] mb-2">
            <Check size={28} strokeWidth={4} />
          </div>
          <span className="font-bold text-[#1a1a2e]">多音字辨析</span>
        </div>
      </div>
    </motion.div>
  );

  const renderErrorBook = () => (
    <motion.div 
      key="error-book"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 pb-24"
    >
      <div className="p-6 pt-10 flex-1 overflow-y-auto">
        <h2 className="text-3xl font-display font-bold text-[#1a1a2e] flex items-center gap-2 mb-2">
          <RefreshCw className="text-[var(--color-secondary)]" /> 记忆复活站
        </h2>
        <p className="text-gray-500 font-bold mb-6 text-sm">错题不是用来收藏的，我们用它精准提分。</p>
        
        <div className="flex gap-2 mb-6">
          <button className="flex-1 bg-[#1a1a2e] text-white font-bold py-2 rounded-xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]">{errorList.length > 0 ? "急救中" : "无急救"}</button>
          <button className="flex-1 bg-white text-gray-400 font-bold py-2 rounded-xl border-2 border-gray-200">72h 巩固</button>
          <button className="flex-1 bg-white text-gray-400 font-bold py-2 rounded-xl border-2 border-gray-200">7d 保分</button>
        </div>

        <div className="space-y-4">
          {errorList.length === 0 ? (
             <div className="text-center text-gray-400 mt-10 font-bold border-2 border-gray-200 border-dashed rounded-xl p-8">
               太棒了，目前没有待复活的知识点！
             </div>
          ) : (
             errorList.map((err, idx) => (
               <div key={err.id || idx} className="game-card p-4 relative flex flex-col border-l-8 border-l-[var(--color-subj-en)]">
                 <div className="flex justify-between items-start mb-2">
                   <span className="text-[var(--color-subj-en)] font-bold text-sm line-clamp-1">{err.painPoint || '综合测试'}</span>
                   <span className="text-xs font-bold bg-[#1a1a2e] text-white px-2 py-1 rounded whitespace-nowrap">待复活</span>
                 </div>
                 <h4 className="font-bold text-lg mb-2 text-[#1a1a2e] line-clamp-2">{err.rule || err.questionText?.substring(0, 30)}</h4>
                 <div className="flex gap-2 mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                   <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded border border-gray-200 whitespace-nowrap">近期错题</span>
                   <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded border border-gray-200 whitespace-nowrap">高频重灾区</span>
                 </div>
                 
                 <div className="flex gap-2 mt-auto">
                   <button 
                     onClick={() => generateCloneQuestion(err)}
                     className="game-btn bg-gray-200 text-gray-600 flex-1 py-3 text-sm flex justify-center items-center gap-1 border-0"
                   >
                     文本题
                   </button>
                   <button 
                     onClick={() => generateTheaterScript(err)}
                     className="game-btn bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white flex-[2] py-3 text-sm flex justify-center items-center gap-2 border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] animate-pulse"
                   >
                     ✨ 次元剧场：沉浸式重构
                   </button>
                 </div>
               </div>
             ))
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderOverview = () => (
    <motion.div 
      key="overview"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 pb-24 p-6 pt-10"
    >
      <h2 className="text-3xl font-display font-bold text-[#1a1a2e] flex items-center gap-2 mb-6">
        <Trophy className="text-[var(--color-primary)]" /> 家长驾驶舱
      </h2>
      <div className="bg-[#1a1a2e] text-white p-6 rounded-[32px] border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] mb-6 relative overflow-hidden">
        <div className="absolute top-4 right-4 opacity-10"><Trophy size={100} /></div>
        <p className="text-gray-400 font-bold mb-2 text-sm relative z-10">本周效率评估</p>
        <div className="flex items-end gap-2 mb-4 relative z-10">
          <span className="text-5xl font-display font-bold text-[var(--color-primary)]">S</span>
          <span className="text-lg font-bold">极佳</span>
        </div>
        <p className="font-medium text-sm relative z-10 leading-relaxed text-gray-300">
          累计省下低效练习时间 <span className="text-[var(--color-secondary)] font-bold text-lg">{timeSaved} 分钟</span>，
          预测周末 Boss 战将额外提分 <span className="text-[var(--color-accent-green)] font-bold text-lg">+18 分</span>。
        </p>
      </div>

      <h3 className="font-bold text-lg mb-3">近期核心进展</h3>
      <div className="game-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="font-bold text-[#1a1a2e] text-sm">攻克高危知识点</span>
          <span className="text-[var(--color-primary)] font-bold">4 个</span>
        </div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="font-bold text-[#1a1a2e] text-sm">错题重复失效率</span>
          <span className="text-[var(--color-accent-green)] font-bold text-sm">↓ 12% (稳步下降)</span>
        </div>
      </div>
    </motion.div>
  );

  const [combatAnswer, setCombatAnswer] = useState('');

  const renderCombat = () => {
    if (aiMode === 'analyzing') {
      return (
        <motion.div 
          key="analyze"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[var(--color-secondary)] text-[#1a1a2e]"
        >
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mb-8"
          >
            <Camera size={80} />
          </motion.div>
          <h2 className="text-3xl font-display font-bold mb-4">多模态剥离中...</h2>
          <div className="w-64 space-y-3">
             <div className="flex items-center gap-2 font-bold"><Check size={18}/> 提取题干与迷惑图层</div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 font-bold"><Check size={18}/> 检索全网真题同源模型</motion.div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-2 font-bold"><Check size={18}/> 生成定制化“一句话法则”</motion.div>
          </div>
        </motion.div>
      );
    }

    const isAiContent = aiMode === 'ready' && aiData;

    return (
      <motion.div 
        key="combat"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-white"
      >
        <div className="p-4 border-b-2 border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isAiContent ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-subj-ma)]'}`}></div>
            <span className="font-bold text-sm">{isAiContent ? 'AI 多模态动态推演' : '极光数学 · 几何辅助线'}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 w-24 overflow-hidden border border-gray-300">
            <div className="bg-[var(--color-primary)] w-1/2 h-full"></div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full overflow-y-auto">
          {/* AI Prediction Header */}
          <div className="bg-[var(--color-secondary)]/10 border-2 border-[var(--color-secondary)] rounded-xl p-4 mb-4 flex gap-3 relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-10"><Target size={80} /></div>
             <div className="text-[var(--color-secondary)] z-10"><BrainCircuit size={24} /></div>
             <div className="z-10">
               <h5 className="font-bold text-sm text-[var(--color-secondary)] mb-1">AI 考向超前预判</h5>
               <p className="text-xs font-bold text-[#1a1a2e] opacity-80 leading-relaxed">
                 {isAiContent ? `【痛点锁定】：${aiData.painPoint}。掌握规则可直接避开陷阱。` : '分析全国近 3 年期末真题库证实，此模型【必考频率 96%】。拿下它可直接锁定 +4 分。'}
               </p>
             </div>
          </div>

          {/* Core Rule */}
          <div className="bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)] rounded-xl p-4 mb-6 flex gap-3">
            <div className="bg-[var(--color-primary)] text-white rounded-full p-2 h-fit border-2 border-[#1a1a2e] min-w-fit"><Beaker size={20} /></div>
            <div>
              <h5 className="font-bold text-[var(--color-primary)] text-sm mb-1 uppercase tracking-wider">一句话法则</h5>
              <p className="font-bold text-[#1a1a2e]">{isAiContent ? aiData.rule : '遇中点，连中线。构造平行四边形或中位线定理。'}</p>
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 mb-6">
            <h3 className="font-bold text-lg mb-4">实战检测</h3>
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200 mb-6 relative">
              <p className="text-[#1a1a2e] font-medium leading-relaxed mb-6 whitespace-pre-wrap">
                {isAiContent ? aiData.questionText : '在 △ABC 中，D 为 AB 边上的中点，已知 AC = 8，BC = 6。为了求 CD 的取值范围，第一步最稳妥的辅助线应该怎么画？'}
              </p>
              
              <div className="space-y-3 mt-4">
                {(isAiContent ? aiData.options : ['过 D 作 DE // BC', '延长 CD 至 E，使 DE = CD，连接 AE, BE', '过 C 作 CF ⊥ AB', '作 BC 的垂直平分线']).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCombatAnswer(option)}
                    className={`w-full text-left p-4 rounded-xl border-2 font-bold transition-all ${
                      combatAnswer === option 
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-[2px_2px_0_var(--color-primary)]' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}. {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white border-t-2 border-gray-100 pb-safe">
          <button 
            disabled={!combatAnswer}
            onClick={() => setCurrentScreen('combat-feedback')}
            className={`game-btn text-white w-full py-4 text-lg flex justify-center items-center gap-2 ${
              combatAnswer ? 'bg-[var(--color-primary)]' : 'bg-gray-300 cursor-not-allowed border-gray-400 border-b-4'
            }`}
          >
            提交校验 <ChevronRight />
          </button>
        </div>
      </motion.div>
    );
  };

  const renderDehydrator = () => {
    if (dehydrateMode === 'analyzing') {
      return (
        <motion.div 
          key="analyze-dehydrate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#1a1a2e] text-white"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/matrix-stampa.png')] opacity-20 animate-pulse"></div>
          <motion.div
            animate={{ rotate: -360, scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-8 relative z-10 text-[var(--color-secondary)]"
          >
            <Cpu size={100} />
          </motion.div>
          <h2 className="text-3xl font-display font-bold mb-4 relative z-10 text-[var(--color-secondary)] drop-shadow-[0_0_10px_var(--color-secondary)]">暴风脱水中...</h2>
          <div className="w-72 space-y-3 relative z-10">
             <div className="flex items-center gap-2 font-bold text-gray-300"><Check className="text-[var(--color-accent-green)]" size={18}/> 扫描整卷知识点矩阵</div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 font-bold text-gray-300"><Check className="text-[var(--color-accent-green)]" size={18}/> 计算 115 分边界 ROI 极值</motion.div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-2 font-bold text-[var(--color-accent-pink)]"><Zap size={18}/> 废除无效机械惩罚任务</motion.div>
          </div>
        </motion.div>
      );
    }

    const data = dehydrateData;
    if (!data) return null;

    const savedMins = (data.trashEasy + data.dropHard) * 5;

    return (
      <motion.div 
        key="dehydrate-result"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-[#1a1a2e] text-white overflow-y-auto"
      >
        <div className="p-6 pt-12 pb-24 max-w-lg mx-auto w-full relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-secondary)] opacity-10 blur-[100px] rounded-full"></div>
          
          <h2 className="text-4xl font-display font-bold text-[var(--color-secondary)] mb-2 flex items-center gap-3">
            <ShieldAlert size={36} /> 脱水完毕
          </h2>
          <p className="text-gray-400 font-bold mb-8">
            传统教育会让你把 {data.total} 题全做完。我帮你砸碎了其中 {data.trashEasy + data.dropHard} 题。
          </p>

          {/* Stats Bar */}
          <div className="bg-white/10 rounded-2xl p-4 border border-white/20 mb-6 font-mono grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
            <div>
              <div className="text-3xl font-bold text-[var(--color-accent-pink)]">{data.dropHard}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">超纲放弃 (Drop)</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-500">{data.trashEasy}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">机械重复 (Trash)</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--color-accent-green)]">{data.mustDo}</div>
              <div className="text-[10px] text-[var(--color-accent-green)] font-bold uppercase mt-1">高悬赏区 (Must Do)</div>
            </div>
          </div>

          <div className="bg-[var(--color-secondary)] text-[#1a1a2e] rounded-xl p-5 mb-8 border-4 border-[#1a1a2e] shadow-[4px_4px_0_rgba(255,255,255,0.2)]">
            <h3 className="font-black text-xl mb-2 flex items-center gap-2"><Trophy size={20} /> AI 核心指令：</h3>
            <p className="font-bold leading-relaxed">{data.reasoning}</p>
          </div>

          <div className="border-l-4 border-[var(--color-accent-green)] pl-4 mb-10">
            <h4 className="text-sm font-bold text-gray-400 mb-1">你今晚只需要完成以下题目：</h4>
            <div className="text-2xl font-black text-white">{data.mustDoIndices || '无，全部免做！'}</div>
          </div>

          <div className="bg-[var(--color-accent-pink)]/20 border border-[var(--color-accent-pink)] rounded-xl p-4 flex gap-3 text-[var(--color-accent-pink)] mb-10">
            <Lock size={24} className="shrink-0" />
            <p className="text-sm font-bold mt-1">
              注意：其它题型已被强行列入【战略放弃区】，系统禁止你在这上面浪费时间去换取那微茫的分数。
            </p>
          </div>

        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1a1a2e]/90 backdrop-blur pb-safe text-center w-full max-w-md mx-auto z-50 border-t border-white/10">
          <p className="text-[var(--color-secondary)] font-bold mb-3">为你的青春挽回了 {savedMins} 分钟</p>
          <button 
            onClick={() => {
              setCurrentScreen('dashboard');
              setDehydrateMode('idle');
              setDehydrateData(null);
            }}
            className="game-btn bg-[var(--color-secondary)] text-[#1a1a2e] w-full py-4 text-lg border-2 border-transparent"
          >
            批准执行，生成免做凭证
          </button>
        </div>
      </motion.div>
    );
  };
  const renderCombatFeedback = () => {
    const isAiContent = aiMode === 'ready' && aiData;
    const isCorrect = isAiContent ? combatAnswer === aiData.correctAnswer : combatAnswer === '延长 CD 至 E，使 DE = CD，连接 AE, BE';
    
    if (!isCorrect) {
      return (
        <motion.div 
          key="socratic-feedback"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 w-full h-full flex flex-col bg-[#0a0a0a] text-[#00ff41] p-6 text-left font-mono"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20"></div>
          
          <div className="flex-1 w-full max-w-sm mx-auto relative z-10 flex flex-col pt-12">
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ delay: 0.1 }}
              className="mb-6 font-bold"
            >
              {">"} ERROR: LOGIC BREACH DETECTED.
            </motion.div>
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ delay: 0.8 }}
              className="mb-6 font-bold text-gray-400"
            >
              {">"} INITIATING SOCRATIC INCEPTION...
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 1.5 }}
              className="mb-8 border-l-4 border-[#00ff41] pl-4 text-lg"
            >
              <p className="mb-2">"Wake up. You chose <span className="text-[#ff003c]">{combatAnswer || 'an incorrect path'}</span>."</p>
              <p className="text-white mt-4 leading-relaxed">
                {isAiContent ? aiData.rule : 'The key is "midpoint (中点)". If you have a midpoint, what happens if you double the median line?'}
              </p>
              <p className="text-xs text-gray-500 mt-4">_ System has logged this into your Error Resurrection Queue.</p>
            </motion.div>

            <div className="mt-auto mb-8">
              <button 
                onClick={async () => {
                   if (isAiContent && user) {
                     await saveErrorRecord(user.uid, aiData);
                   }
                   setCurrentScreen('combat');
                   setCombatAnswer('');
                }}
                className="w-full bg-transparent border-2 border-[#00ff41] text-[#00ff41] py-4 font-bold uppercase tracking-widest hover:bg-[#00ff41] hover:text-black transition-colors"
              >
                [ Retry Override ]
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        key="feedback-success"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-[var(--color-accent-green)] text-[#1a1a2e] justify-center items-center p-6 text-center"
      >
        <div className="absolute top-0 right-0 p-10 opacity-20">
          <SparkleIcon size={120} />
        </div>
        
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
          className="bg-white rounded-full w-28 h-28 flex items-center justify-center border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] mb-8 z-10 text-[var(--color-accent-green)]"
        >
          <Check size={56} strokeWidth={4} />
        </motion.div>

        <h2 className="font-display text-4xl font-bold mb-4 relative z-10 retro-text-shadow text-white">
          正确！修复成功
        </h2>
        <p className="text-lg font-bold mb-8 bg-white/20 text-[#1a1a2e] p-4 rounded-2xl border-2 border-[#1a1a2e] relative z-10 shadow-[4px_4px_0_#1a1a2e]">
          {isAiContent ? '完美应用法则成功破茧，你已完全掌握这道题的核心陷阱！' : '识别到了中点，选择“倍长中线”造全等，思路非常完美。这 4 分你拿稳了！'}
        </p>

        <div className="flex gap-4 w-full max-w-sm relative z-10 mt-8">
          <button 
            onClick={async () => {
               // Award points and save
               handleTimeSavedUpdate(15);
               if (isAiContent && (aiData as any)._errorId && user) {
                 await resolveError(user.uid, (aiData as any)._errorId);
               }
               setCurrentScreen('report');
               setAiMode('idle');
               setAiData(null);
               setCombatAnswer('');
            }}
            className="game-btn bg-white text-[#1a1a2e] flex-1 py-4 text-lg"
          >
            收下战利品
          </button>
        </div>
      </motion.div>
    );
  };

  const renderInteractiveTheater = () => {
    if (theaterMode === 'generating') {
      return (
        <motion.div 
          key="theater-gen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-black text-white p-6"
        >
          <div className="text-center">
            <motion.div 
              animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-fuchsia-500 mb-6 flex justify-center"
            >
              <Orbit size={80} strokeWidth={1} />
            </motion.div>
            <h2 className="font-display font-black text-2xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-600 mb-4">MÖBIUS ENGINE INITIALIZING</h2>
            <p className="text-gray-400 font-mono text-xs">Generating Seedance 2.0 Dynamic Video Stream...</p>
            <p className="text-gray-500 font-mono text-[10px] mt-2">Compiling cognitive state... [Frustration: {cogState.frustration}, Focus: {cogState.focus}]</p>
          </div>
        </motion.div>
      );
    }

    if (!theaterScript) return null;

    return (
      <motion.div 
        key="theater-play"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-black overflow-hidden font-sans"
      >
        {/* Mocking a Manga / Anime Frame */}
        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
          
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/40 to-black z-0"></div>
          
          {/* Manga Panel Border */}
          <div className="relative z-10 w-[95%] h-[90%] border-4 border-white/20 p-2 transform rotate-1">
            <div className="w-full h-full border-4 border-white overflow-hidden relative bg-[#111]">
               
               {/* Scene Content */}
               <motion.div 
                 initial={{ y: 50, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className="absolute inset-0 flex items-center justify-center p-8 text-center"
               >
                 {theaterMode === 'playing' && (
                   <div className="space-y-6">
                     <p className="text-2xl font-bold italic text-white drop-shadow-lg leading-relaxed">
                       "{theaterScript.sceneIntro}"
                     </p>
                     <p className="text-fuchsia-400 font-mono text-sm">[ E.M.A Companion Status: <span className="uppercase">{theaterScript.emotion}</span> ]</p>
                   </div>
                 )}
                 {theaterMode === 'interaction' && (
                   <div className="space-y-8 bg-black/80 p-8 rounded-3xl border border-fuchsia-500/50 backdrop-blur-sm">
                     <p className="text-2xl font-bold text-fuchsia-400 drop-shadow-[0_0_10px_rgba(232,121,249,0.8)] animate-pulse">
                       AWAITING YOUR OVERRIDE:
                     </p>
                     <p className="text-xl text-white font-medium">"{theaterScript.interactionPrompt}"</p>
                     
                     <div className="flex flex-col gap-4 pt-4">
                       <button onClick={() => { setTheaterResolution('success'); setTheaterMode('resolution'); }} className="game-btn bg-fuchsia-600 text-white py-4 border-2 border-white shadow-[4px_4px_0_#fff]">
                         [ Execute Rule ] // Success
                       </button>
                       <button onClick={() => { setTheaterResolution('failure'); setTheaterMode('resolution'); }} className="game-btn bg-transparent border-2 border-gray-600 text-gray-400 py-3">
                         [ Ignore Rule ] // Fail
                       </button>
                     </div>
                   </div>
                 )}
                 {theaterMode === 'resolution' && (
                   <div className="space-y-6">
                     <p className={`text-3xl font-black italic ${theaterResolution === 'success' ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-pink)]'}`}>
                       {theaterResolution === 'success' ? 'MISSION ACCOMPLISHED' : 'SYSTEM COLLAPSE'}
                     </p>
                     <p className="text-xl text-white font-bold leading-relaxed">
                       {theaterResolution === 'success' ? theaterScript.successScene : theaterScript.failureScene}
                     </p>
                     <button onClick={() => setCurrentScreen('dashboard')} className="mt-12 game-btn bg-white text-black py-3 px-8 text-lg hover:bg-gray-200">
                       Exit Simulation
                     </button>
                   </div>
                 )}
               </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
  const renderReport = () => (
    <motion.div 
      key="report"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#1a1a2e] text-white p-6 justify-center items-center overflow-hidden"
    >
      <div className="absolute top-1/4 left-0 w-full h-64 bg-[var(--color-secondary)]/20 blur-[100px] rounded-full"></div>
      
      <div className="w-full max-w-sm mx-auto z-10 flex flex-col h-full overflow-y-auto pb-6">
        <div className="flex-1 flex flex-col justify-center mt-10">
          <h2 className="text-center font-bold text-[var(--color-secondary)] text-xl tracking-widest mb-6">TIME RETURNED</h2>
          
          {/* Viral Poster Element */}
          <div className="bg-gradient-to-b from-[#2a2a4a] to-[#1a1a2e] border-2 border-[var(--color-secondary)] rounded-[32px] p-8 text-center mb-8 relative shadow-[0_0_30px_rgba(255,138,61,0.2)]">
            <div className="absolute -top-4 -right-4 bg-[var(--color-primary)] text-white text-xs font-bold px-3 py-1 rounded-full border-2 border-[#1a1a2e] transform rotate-12">
              超越 95% 同龄人
            </div>
            
            <p className="text-gray-300 font-medium mb-1">今日已收回青春时长</p>
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="font-display font-black text-6xl text-[var(--color-secondary)] flex items-end justify-center mb-6 leading-none"
            >
              +{timeSaved ? timeSaved : 26}<span className="text-2xl ml-1 text-white pb-2">min</span>
            </motion.div>
            
            <div className="bg-black/30 rounded-xl p-4 text-left border border-white/10 mb-4">
               <p className="text-sm text-gray-400 mb-1"><Zap size={14} className="inline mr-1 text-[var(--color-primary)]"/> 击碎无用题海：<span className="text-white float-right">15 题</span></p>
               <p className="text-sm text-gray-400 mb-1"><MapIcon size={14} className="inline mr-1 text-[var(--color-accent-green)]"/> 突破薄弱知识：<span className="text-white float-right">3 个</span></p>
            </div>
            
            <div className="text-xs text-gray-500 mt-2 italic flex justify-center items-center gap-1">
               <Lock size={12} /> Powered by FreeScore AI
            </div>
          </div>
          
          <div className="text-center mb-auto">
            <p className="text-lg font-bold text-white mb-2 leading-relaxed">
              “今天省下来的时间，<br/>属于你自己。”
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button 
            className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex justify-center items-center gap-2 border-2 border-transparent"
          >
            <UploadCloud size={20} /> 生成炫耀海报
          </button>
          
          <button 
            onClick={() => {
              setCurrentScreen('dashboard');
            }}
            className="game-btn bg-white/10 text-white w-full py-4 text-lg border-2 border-transparent flex justify-center items-center gap-2"
          >
             返回营地继续休息
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="w-full h-screen bg-[#1a1a2e] flex items-center justify-center font-sans">
      {/* Mobile container constraint for web view */}
      <div className="w-full h-full max-w-md mx-auto bg-white overflow-hidden relative shadow-2xl sm:rounded-[40px] sm:h-[90vh] sm:border-[8px] sm:border-[#1a1a2e]">
        <AnimatePresence mode="wait">
          {currentScreen === 'welcome' && renderWelcome()}
          {currentScreen === 'profile-setup' && renderProfileSetup()}
          {currentScreen === 'diagnostic-loading' && renderDiagnosticLoading()}
          {currentScreen === 'target-setter' && renderTargetSetter()}
          {currentScreen === 'dashboard' && renderDashboard()}
          {currentScreen === 'subject-map' && renderSubjectMap()}
          {currentScreen === 'error-book' && renderErrorBook()}
          {currentScreen === 'overview' && renderOverview()}
          {currentScreen === 'dehydrator' && renderDehydrator()}
          {currentScreen === 'combat' && renderCombat()}
          {currentScreen === 'combat-feedback' && renderCombatFeedback()}
          {currentScreen === 'theater' && renderInteractiveTheater()}
          {currentScreen === 'report' && renderReport()}
        </AnimatePresence>

        {/* E.M.A Companion Sprite Floating Overlay */}
        {['dashboard', 'subject-map'].includes(currentScreen) && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -10, 0] }}
            transition={{ y: { repeat: Infinity, duration: 3, ease: 'easeInOut' } }}
            className="absolute top-20 right-6 z-40 pointer-events-none"
          >
            <div className="relative">
              <div className={`w-12 h-12 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${cogState.frustration > 60 ? 'bg-red-500/80 animate-pulse' : cogState.focus > 70 ? 'bg-blue-500/80' : 'bg-fuchsia-500/80'}`}>
                {cogState.frustration > 60 ? <AlertTriangle size={20} className="text-white" /> : cogState.focus > 70 ? <Zap size={20} className="text-white" /> : <Orbit size={20} className="text-white relative z-10" />}
              </div>
              <div className="absolute top-14 right-0 w-max bg-black/60 backdrop-blur-sm text-[10px] text-white px-2 py-1 rounded-full border border-white/20">
                E.M.A. 陪伴中
              </div>
            </div>
          </motion.div>
        )}
        
        {['dashboard', 'subject-map', 'error-book', 'overview'].includes(currentScreen) && (
          <div className="absolute bottom-0 left-0 right-0 w-full bg-white border-t-4 border-[#1a1a2e] flex justify-around items-center p-3 sm:pb-4 pt-4 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
            <NavButton onClick={() => setCurrentScreen('dashboard')} icon={<Sword />} label="作战" active={currentScreen === 'dashboard'} />
            <NavButton onClick={() => setCurrentScreen('subject-map')} icon={<MapIcon />} label="学科岛" active={currentScreen === 'subject-map'} />
            <NavButton onClick={() => setCurrentScreen('error-book')} icon={<RefreshCw />} label="错题" active={currentScreen === 'error-book'} />
            <NavButton onClick={() => setCurrentScreen('overview')} icon={<Trophy />} label="总览" active={currentScreen === 'overview'} />
          </div>
        )}
      </div>
    </div>
  );
}

const NavButton = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 transition-colors ${active ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.cloneElement(icon as React.ReactElement, { size: active ? 24 : 22, strokeWidth: active ? 3 : 2 })}
    <span className={`text-[10px] font-bold ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
  </button>
);

const SparkleIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4M3 5h4M19 3v4M17 5h4M5 17v4M3 19h4M19 17v4M17 19h4"/>
  </svg>
);
