import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, ChevronLeft, ChevronRight, CheckCircle2, Bookmark } from 'lucide-react';

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

  // Bookmark / Flag for review state
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadExam();
  }, [examId]);

  // Silent tracking of exam tab switches and screenshot attempts
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;

    let hasBlurred = false;

    const recordEvent = async (type: 'tab_switch' | 'screenshot') => {
      try {
        await supabase.rpc('record_violation', { p_attempt_id: attempt.id, p_type: type });
      } catch (_) {
        try {
          await supabase.rpc('record_violation', { p_attempt_id: attempt.id });
        } catch (_) {}
      }
    };

    const handleBlur = () => {
      hasBlurred = true;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hasBlurred = true;
      } else if (hasBlurred) {
        hasBlurred = false;
        recordEvent('tab_switch');
      }
    };

    const handleFocus = () => {
      if (hasBlurred) {
        hasBlurred = false;
        recordEvent('tab_switch');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        recordEvent('screenshot');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch (_) {}
      }

      // Block Ctrl/Cmd combinations silently without alerts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['p', 's', 'u', 'c', 'x', 'a'].includes(key)) {
          e.preventDefault();
        }
      }

      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
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
    const { data } = await supabase.from('attempts').select('*, students(*)').eq('id', attemptId).single();
    if (data) {
      setAttempt(data);
      if (data.violations) setViolationsCount(data.violations);
      if (data.students) {
        setFullName(data.students.full_name || '');
        setUniCode(data.students.university_code || '');
        setPhone(data.students.phone_number || '');
      } else {
        const savedInfo = localStorage.getItem('student_info');
        if (savedInfo) {
          try {
            const parsed = JSON.parse(savedInfo);
            if (parsed.fullName) setFullName(parsed.fullName);
            if (parsed.uniCode) setUniCode(parsed.uniCode);
            if (parsed.phone) setPhone(parsed.phone);
          } catch (_) {}
        }
      }
      const savedBookmarks = localStorage.getItem(`bookmarks_${attemptId}`);
      if (savedBookmarks) {
        try {
          setBookmarks(JSON.parse(savedBookmarks));
        } catch (_) {}
      }
      if (data.status === 'in_progress') await loadQuestions(attemptId);
    } else {
      localStorage.removeItem(`attempt_${examId}`);
    }
    setLoading(false);
  };

  const toggleBookmark = (questionId: string) => {
    setBookmarks(prev => {
      const next = { ...prev, [questionId]: !prev[questionId] };
      if (!next[questionId]) {
        delete next[questionId];
      }
      if (attempt?.id) {
        localStorage.setItem(`bookmarks_${attempt.id}`, JSON.stringify(next));
      }
      return next;
    });
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
      localStorage.setItem('student_info', JSON.stringify({ fullName, uniCode, phone }));
      localStorage.removeItem(`bookmarks_${data.attempt.id}`);
      setBookmarks({});
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
      const confirmMsg = 'هل أنت متأكد من تسليم الامتحان؟ لا يمكنك تغيير إجاباتك بعد التسليم.\n\nAre you sure you want to submit? You cannot change your answers after submission.';
      if (!confirm(confirmMsg)) return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('submit_exam', {
        p_attempt_id: attempt.id,
        p_submission_type: type,
      });
      if (error) throw error;
      if (data && data.success) {
        const { data: updated } = await supabase.from('attempts').select('*').eq('id', attempt.id).single();
        setAttempt(updated ?? { ...attempt, status: data.status || 'submitted', submission_type: type });
      } else {
        setAttempt((prev: any) => ({ ...prev, status: 'submitted', submission_type: type }));
      }
    } catch (err) {
      console.error(err);
      setAttempt((prev: any) => ({ ...prev, status: 'submitted', submission_type: type }));
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xs">
            <CheckCircle size={36} />
          </div>
          <h2 className="text-2xl font-bold mb-1 text-gray-800">
            تم تسليم الامتحان بنجاح
          </h2>
          <p className="text-sm font-semibold text-gray-400 mb-3 font-mono" dir="ltr">
            Exam Submitted Successfully
          </p>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">
            تم استلام وتسجيل جميع إجاباتك بنجاح في النظام.
          </p>

          {exam?.show_results && hasScore ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6 text-center">
              <p className="text-sm font-bold text-blue-700 mb-1">الدرجة النهائية / Score</p>
              <div className="text-4xl font-extrabold text-blue-900 my-2">
                {attempt.score} <span className="text-xl text-blue-600 font-semibold">/ {attempt.max_score}</span>
              </div>
              {percentage !== null && (
                <div className="mt-2 inline-block px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                  {percentage}%
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-blue-200/60 text-xs text-gray-600">
                <div>
                  <span className="block font-bold text-gray-800 text-sm">{attempt.answered_questions ?? '-'}</span>
                  <span>الأسئلة المجاب عليها</span>
                </div>
                <div>
                  <span className="block font-bold text-gray-800 text-sm">{attempt.unanswered_questions ?? '-'}</span>
                  <span>لم تتم الإجابة</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-900 leading-relaxed font-medium">
              تم استلام إجاباتك بنجاح. سيتم مراجعة النتائج وإعلانها من قبل إدارة الامتحان.
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>الامتحان: {exam?.title}</span>
            <span>الطالب: {fullName || '-'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Exam Page (single question view) ────────────────────────────────────────
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const bookmarkedCount = Object.keys(bookmarks).length;
  const totalQuestions = questions.length;

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col select-none"
      dir={dir}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="w-full px-4 md:px-8 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 truncate flex-1">
            <h1 className="font-bold text-lg text-gray-800 truncate">{exam?.title}</h1>
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
          {questions.map((q, i) => {
            const isCurrent = i === currentIndex;
            const isAnswered = !!answers[q.id];
            const isBookmarked = !!bookmarks[q.id];
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`relative w-8 h-8 rounded-full text-xs font-bold transition-all border-2 flex items-center justify-center ${
                  isCurrent
                    ? 'bg-blue-600 text-white border-blue-600 scale-110 shadow-sm'
                    : isBookmarked
                    ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-200'
                    : isAnswered
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'
                }`}
                title={`Question ${i + 1}${isBookmarked ? ' • Bookmarked (مراجعة لاحقاً)' : ''}${isAnswered ? ' • Answered (تمت الإجابة)' : ''}`}
              >
                {i + 1}
                {isBookmarked && isCurrent && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-300 rounded-full border border-white" />
                )}
                {isBookmarked && isAnswered && !isCurrent && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-300 rounded-full border border-white" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Answered: <strong>{answeredCount}</strong></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Bookmarked: <strong>{bookmarkedCount}</strong></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 border border-gray-400" />
            <span>Remaining: <strong>{Math.max(0, totalQuestions - answeredCount)}</strong></span>
          </span>
        </div>
      </div>

      {/* Main question area */}
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6">
        {currentQuestion && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex-1">
            {/* Question card top bar: Question counter & Bookmark toggle */}
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                {answers[currentQuestion.id] && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={12} />
                    Answered
                  </span>
                )}
              </div>

              {/* Bookmark Toggle Button */}
              <button
                type="button"
                onClick={() => toggleBookmark(currentQuestion.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  bookmarks[currentQuestion.id]
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs hover:bg-amber-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                }`}
                title={bookmarks[currentQuestion.id] ? 'Remove bookmark' : 'Bookmark question for review'}
              >
                <Bookmark
                  size={14}
                  className={bookmarks[currentQuestion.id] ? 'fill-white text-white' : 'text-amber-500'}
                />
                <span>
                  {bookmarks[currentQuestion.id]
                    ? 'Bookmarked / علامة مرجعية'
                    : 'Bookmark / علامة مرجعية'}
                </span>
              </button>
            </div>

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
