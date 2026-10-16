import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, ChevronLeft, ChevronRight, CheckCircle2, Shield, ShieldAlert, AlertTriangle } from 'lucide-react';

const CheckCircle = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

export default function ExamPortal() {
  const { examId } = useParams();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lang] = useState<'en' | 'ar'>('en');

  // Registration state
  const [fullName, setFullName] = useState('');
  const [uniCode, setUniCode] = useState('');
  const [phone, setPhone] = useState('');
  const [formErrors, setFormErrors] = useState<{ uniCode?: string; phone?: string }>({});

  // Attempt state
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Single-question navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  // Anti-Cheat & Screen Protection state
  const [isScreenBlurred, setIsScreenBlurred] = useState(false);
  const [violationsCount, setViolationsCount] = useState(0);
  const [showViolationAlert, setShowViolationAlert] = useState(false);

  useEffect(() => {
    loadExam();
  }, [examId]);

  // Anti-Cheat: Screen protection & tab switch monitoring
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;

    let hasBlurred = false;

    const handleBlur = () => {
      setIsScreenBlurred(true);
      hasBlurred = true;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsScreenBlurred(true);
        hasBlurred = true;
      }
    };

    const recordViolationOnServer = async () => {
      try {
        await supabase.rpc('record_violation', { p_attempt_id: attempt.id });
      } catch (_) {}
    };

    const handleFocus = () => {
      if (hasBlurred) {
        setViolationsCount(prev => prev + 1);
        setShowViolationAlert(true);
        recordViolationOnServer();
        hasBlurred = false;
      }
      setIsScreenBlurred(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        setIsScreenBlurred(true);
        hasBlurred = true;
        setViolationsCount(prev => prev + 1);
        setShowViolationAlert(true);
        recordViolationOnServer();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch (_) {}
        return;
      }

      // Block Ctrl/Cmd combinations: Print (P), Save (S), Source (U), Copy (C), Cut (X), SelectAll (A)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['p', 's', 'u', 'c', 'x', 'a'].includes(key)) {
          e.preventDefault();
        }
        // Block DevTools shortcuts (Ctrl+Shift+I / J / C)
        if (e.shiftKey && ['i', 'j', 'c'].includes(key)) {
          e.preventDefault();
        }
      }

      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopyCut);
    window.addEventListener('cut', handleCopyCut);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopyCut);
      window.removeEventListener('cut', handleCopyCut);
    };
  }, [attempt?.status]);

  // Timer
  useEffect(() => {
    let interval: any;
    if (attempt && attempt.status === 'in_progress' && attempt.deadline_at) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const deadline = new Date(attempt.deadline_at).getTime();
        const diff = Math.floor((deadline - now) / 1000);
        if (diff <= 0) {
          clearInterval(interval);
          setTimeLeft(0);
          submitExam('auto');
        } else {
          setTimeLeft(diff);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [attempt]);

  const loadExam = async () => {
    const { data } = await supabase.from('exams').select('*').eq('id', examId).eq('is_published', true).single();
    if (data) {
      setExam(data);
      const savedAttempt = localStorage.getItem(`attempt_${examId}`);
      if (savedAttempt) {
        resumeAttempt(savedAttempt);
      } else {
        setLoading(false);
      }
    } else {
      setError('الامتحان غير موجود أو غير متاح حالياً.');
      setLoading(false);
    }
  };

  const resumeAttempt = async (attemptId: string) => {
    const { data } = await supabase.from('attempts').select('*').eq('id', attemptId).single();
    if (data) {
      setAttempt(data);
      if (data.status === 'in_progress') await loadQuestions(attemptId);
    } else {
      localStorage.removeItem(`attempt_${examId}`);
    }
    setLoading(false);
  };

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: { uniCode?: string; phone?: string } = {};
    const uniCodeDigits = uniCode.replace(/\D/g, '');
    const phoneDigits = phone.replace(/\D/g, '');

    if (uniCodeDigits.length !== 9) {
      errors.uniCode = 'University code must be exactly 9 digits';
    }
    if (phoneDigits.length !== 11) {
      errors.phone = 'WhatsApp number must be exactly 11 digits';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.rpc('start_exam', {
        p_exam_id: examId,
        p_full_name: fullName,
        p_university_code: uniCode,
        p_phone_number: phone,
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setAttempt(data.attempt);
      localStorage.setItem(`attempt_${examId}`, data.attempt.id);
      await loadQuestions(data.attempt.id);
    } catch (err: any) {
      setError(err.message || 'فشل بدء الامتحان');
    }
    setLoading(false);
  };

  const loadQuestions = async (attemptId: string) => {
    const { data: qData } = await supabase
      .from('questions')
      .select('*, options(*)')
      .eq('exam_id', examId)
      .order('order_num');
    if (qData) setQuestions(qData);

    const { data: aData } = await supabase.from('answers').select('*').eq('attempt_id', attemptId);
    if (aData) {
      const ansMap: Record<string, string> = {};
      aData.forEach((a) => { ansMap[a.question_id] = a.selected_option_id; });
      setAnswers(ansMap);
    }
  };

  const handleAnswerSelect = async (questionId: string, optionId: string) => {
    if (attempt?.status !== 'in_progress') return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    await supabase.from('answers').upsert(
      { attempt_id: attempt.id, question_id: questionId, selected_option_id: optionId },
      { onConflict: 'attempt_id,question_id' }
    );
  };

  const submitExam = async (type: 'manual' | 'auto') => {
    if (type === 'manual') {
      const confirmMsg = lang === 'ar'
        ? 'هل أنت متأكد من تسليم الامتحان؟ لا يمكنك تغيير إجاباتك بعد التسليم.'
        : 'Are you sure you want to submit? You cannot change answers after submission.';
      if (!confirm(confirmMsg)) return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('submit_exam', {
        p_attempt_id: attempt.id,
        p_submission_type: type,
      });
      if (error) throw error;
      if (data.success) {
        const { data: updated } = await supabase.from('attempts').select('*').eq('id', attempt.id).single();
        setAttempt(updated ?? { ...attempt, status: data.status || 'submitted' });
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const dir = 'ltr'; // Left-to-right for English interface

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading && !attempt) return (
    <div className="min-h-screen flex items-center justify-center" dir={dir}>
      <div className="text-gray-500 text-lg">Loading exam...</div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" dir={dir}>
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-8 text-center max-w-md font-semibold">{error}</div>
    </div>
  );

  // ─── Registration Form ────────────────────────────────────────────────────────
  if (!attempt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4" dir={dir}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-gray-100">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-gray-800">{exam?.title}</h1>
            {exam?.instructions && <p className="text-gray-500 mt-2 text-sm leading-relaxed">{exam.instructions}</p>}
            <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Clock size={14} />
              <span>Duration: {exam?.duration_minutes} minutes</span>
            </div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">{error}</div>}

          <form onSubmit={handleStart} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                required
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {/* University Code */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">University Code / ID</label>
              <input
                required
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={9}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${formErrors.uniCode ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                placeholder="9 digits"
                value={uniCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setUniCode(val);
                  if (formErrors.uniCode) setFormErrors(prev => ({ ...prev, uniCode: undefined }));
                }}
              />
              {formErrors.uniCode && <p className="text-red-500 text-xs mt-1">{formErrors.uniCode}</p>}
              <p className="text-gray-400 text-xs mt-1">{uniCode.length} / 9 digits</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp Number</label>
              <input
                required
                type="tel"
                inputMode="numeric"
                pattern="\d*"
                maxLength={11}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${formErrors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                placeholder="11 digits"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPhone(val);
                  if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: undefined }));
                }}
              />
              {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              <p className="text-gray-400 text-xs mt-1">{phone.length} / 11 digits</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-base hover:bg-blue-700 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Starting exam...' : 'Start Exam Now'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Submitted / Expired Screen ───────────────────────────────────────────────
  if (attempt.status !== 'in_progress') {
    const hasScore = attempt.score !== null && attempt.score !== undefined;
    const percentage = hasScore && attempt.max_score > 0
      ? Math.round((attempt.score / attempt.max_score) * 100)
      : null;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={dir}>
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Exam Submitted Successfully</h2>
          <p className="text-gray-500 mb-6 text-sm">Your answers have been securely recorded on the server.</p>

          {exam?.show_results && hasScore ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6">
              <p className="text-sm font-medium text-blue-700 mb-1">Your Final Score</p>
              <div className="text-4xl font-extrabold text-blue-900 my-2">
                {attempt.score} <span className="text-xl text-blue-600 font-semibold">/ {attempt.max_score}</span>
              </div>
              {percentage !== null && (
                <div className="mt-3 inline-block px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                  {percentage}%
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-blue-200/60 text-xs text-gray-600">
                <div>
                  <span className="block font-semibold text-gray-700 text-sm">{attempt.answered_questions ?? '-'}</span>
                  <span>Questions answered</span>
                </div>
                <div>
                  <span className="block font-semibold text-gray-700 text-sm">{attempt.unanswered_questions ?? '-'}</span>
                  <span>Unanswered</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
              Results will be reviewed and announced by the administration.
            </div>
          )}
          <div className="text-xs text-gray-400">Exam: {exam?.title}</div>
        </div>
      </div>
    );
  }

  // ─── Exam Page (single question view) ────────────────────────────────────────
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col select-none"
      dir={dir}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Print protection style: hides entire page if printed */}
      <style>{`
        @media print {
          body, html {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* Screen Protection Shield Overlay (Active during screenshots / focus loss) */}
      {isScreenBlurred && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white text-center p-6 select-none animate-in fade-in duration-100">
          <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-5 ring-8 ring-red-500/10">
            <ShieldAlert size={44} />
          </div>
          <h2 className="text-2xl font-bold mb-2">⚠️ Screen Protected / الشاشة محمية</h2>
          <p className="text-slate-300 max-w-md text-sm leading-relaxed mb-6">
            Screenshots, screen capture tools, and switching tabs are strictly prohibited during the exam.
            <br />
            <span className="text-xs text-slate-400 mt-2 block">
              ممنوع التقاط لقطات الشاشة أو مغادرة صفحة الامتحان. انقر للمتابعة.
            </span>
          </p>
          <button
            onClick={() => setIsScreenBlurred(false)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition shadow-lg"
          >
            Click to Return to Exam (العودة للامتحان)
          </button>
        </div>
      )}

      {/* Security Alert Modal (Triggered when user returns after leaving) */}
      {showViolationAlert && !isScreenBlurred && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-amber-200">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Security Warning / تنبيه أمني</h3>
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              You navigated away from the exam or triggered a screen capture shortcut.
              <br />
              <span className="text-red-600 font-bold mt-2 block">
                تم رصد مغادرة شاشة الامتحان أو محاولة تصوير (مخالفة رقم: {violationsCount})
              </span>
            </p>
            <button
              onClick={() => setShowViolationAlert(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-sm transition"
            >
              I Understand & Continue (موافق والمتابعة)
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="w-full px-4 md:px-8 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 truncate flex-1">
            <h1 className="font-bold text-lg text-gray-800 truncate">{exam?.title}</h1>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold shrink-0">
              <Shield size={13} />
              <span>Protected</span>
              {violationsCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                  {violationsCount} {violationsCount === 1 ? 'alert' : 'alerts'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`flex items-center gap-2 font-mono text-base font-bold px-3 py-1.5 rounded-lg ${timeLeft !== null && timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
              <Clock size={16} />
              <span>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</span>
            </div>
            <button
              onClick={() => submitExam('manual')}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{loading ? 'Submitting...' : 'Submit Exam'}</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 h-1.5">
          <div
            className="bg-blue-500 h-1.5 transition-all duration-300"
            style={{ width: `${totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0}%` }}
          />
        </div>
      </header>

      {/* Question navigator dots */}
      <div className="bg-white border-b border-gray-100 py-3 px-4 overflow-x-auto">
        <div className="flex gap-1.5 max-w-3xl mx-auto justify-center flex-wrap">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-all border-2 ${
                i === currentIndex
                  ? 'bg-blue-600 text-white border-blue-600 scale-110'
                  : answers[q.id]
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'
              }`}
              title={`Question ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Answered {answeredCount} of {totalQuestions} questions
        </p>
      </div>

      {/* Main question area */}
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6">
        {currentQuestion && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex-1">
            {/* Question header */}
            <div className="flex items-start gap-3.5 mb-6">
              <span className="shrink-0 w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm mt-1">
                {currentIndex + 1}
              </span>
              <div className="flex-1 p-4 bg-slate-50/80 border border-slate-200 rounded-xl shadow-xs">
                <h2 className="text-gray-900 font-semibold text-lg leading-relaxed">{currentQuestion.text}</h2>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options?.map((opt: any) => {
                const isSelected = answers[currentQuestion.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-400'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <input
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => handleAnswerSelect(currentQuestion.id, opt.id)}
                      className="sr-only"
                    />
                    <span className="text-gray-700 text-base">{opt.text}</span>
                    {isSelected && <CheckCircle2 size={18} className="text-blue-500 ml-auto shrink-0" />}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-5 gap-3">
          {/* Previous */}
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          <span className="text-sm text-gray-400 font-medium">
            Question {currentIndex + 1} of {totalQuestions}
          </span>

          {/* Next */}
          <button
            onClick={() => setCurrentIndex(i => Math.min(totalQuestions - 1, i + 1))}
            disabled={currentIndex === totalQuestions - 1}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>
      </main>
    </div>
  );
}
