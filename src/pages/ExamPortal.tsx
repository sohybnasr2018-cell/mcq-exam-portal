import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, AlertCircle } from 'lucide-react';

export default function ExamPortal() {
  const { examId } = useParams();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  // Registration state
  const [fullName, setFullName] = useState('');
  const [uniCode, setUniCode] = useState('');
  const [phone, setPhone] = useState('');

  // Attempt state
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    loadExam();
  }, [examId]);

  // Timer interval
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
          handleAutoSubmit();
        } else {
          setTimeLeft(diff);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [attempt]);

  const loadExam = async () => {
    const { data, error } = await supabase.from('exams').select('*').eq('id', examId).eq('is_published', true).single();
    if (data) {
      setExam(data);
      // Check if attempt token exists in localStorage
      const savedAttempt = localStorage.getItem(`attempt_${examId}`);
      if (savedAttempt) {
        resumeAttempt(savedAttempt);
      } else {
        setLoading(false);
      }
    } else {
      setError(lang === 'ar' ? 'الامتحان غير موجود أو غير متاح حالياً.' : 'Exam not found or not currently available.');
      setLoading(false);
    }
  };

  const resumeAttempt = async (attemptId: string) => {
    const { data } = await supabase.from('attempts').select('*').eq('id', attemptId).single();
    if (data) {
      setAttempt(data);
      if (data.status === 'in_progress') {
         await loadQuestions(attemptId);
      }
    } else {
      localStorage.removeItem(`attempt_${examId}`);
    }
    setLoading(false);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('start_exam', {
        p_exam_id: examId,
        p_full_name: fullName,
        p_university_code: uniCode,
        p_phone_number: phone
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setAttempt(data.attempt);
      localStorage.setItem(`attempt_${examId}`, data.attempt.id);
      await loadQuestions(data.attempt.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start exam');
    }
    setLoading(false);
  };

  const loadQuestions = async (attemptId: string) => {
    // Load questions and options
    const { data: qData } = await supabase.from('questions').select('*, options(*)').eq('exam_id', examId).order('order_num');
    if (qData) {
      setQuestions(qData);
    }

    // Load existing answers for this attempt
    const { data: aData } = await supabase.from('answers').select('*').eq('attempt_id', attemptId);
    if (aData) {
      const ansMap: Record<string, string> = {};
      aData.forEach(a => {
        ansMap[a.question_id] = a.selected_option_id;
      });
      setAnswers(ansMap);
    }
  };

  const handleAnswerSelect = async (questionId: string, optionId: string) => {
    if (attempt.status !== 'in_progress') return;

    // Optimistic update
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));

    // Save to DB using upsert on unique constraint (attempt_id, question_id)
    const { error } = await supabase.from('answers').upsert({
      attempt_id: attempt.id,
      question_id: questionId,
      selected_option_id: optionId
    }, { onConflict: 'attempt_id,question_id' });

    if (error) {
      console.error('Failed to save answer', error);
      // Revert optimism if needed (omitted for brevity)
    }
  };

  const handleManualSubmit = async () => {
    const confirmMsg = lang === 'ar' 
      ? 'هل أنت متأكد من تسليم الامتحان؟ لا يمكنك تغيير إجاباتك بعد التسليم.' 
      : 'Are you sure you want to submit your exam? You cannot change your answers after submission.';
    if (!confirm(confirmMsg)) return;
    await submitExam('manual');
  };

  const handleAutoSubmit = async () => {
    await submitExam('auto');
  };

  const submitExam = async (type: 'manual' | 'auto') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('submit_exam', {
        p_attempt_id: attempt.id,
        p_submission_type: type
      });
      
      if (error) throw error;
      if (data.success) {
        // Fetch the updated attempt record containing score and statistics
        const { data: updatedAttempt } = await supabase
          .from('attempts')
          .select('*')
          .eq('id', attempt.id)
          .single();

        if (updatedAttempt) {
          setAttempt(updatedAttempt);
        } else {
          setAttempt({ ...attempt, status: data.status || 'submitted' });
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading && !attempt) return <div className="p-8 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600 font-bold" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{error}</div>;

  if (!attempt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="absolute top-4 right-4">
           <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="px-3 py-1 bg-white shadow rounded-md text-sm font-medium">
             {lang === 'en' ? 'عربي' : 'English'}
           </button>
        </div>
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{exam?.title}</h1>
          <p className="text-gray-600 mb-6">{exam?.instructions}</p>
          
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}</label>
              <input required type="text" className="w-full mt-1 p-2 border rounded" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'الرقم الجامعي' : 'University Code / ID'}</label>
              <input required type="text" className="w-full mt-1 p-2 border rounded" value={uniCode} onChange={e => setUniCode(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'رقم الواتساب' : 'WhatsApp Phone Number'}</label>
              <input required type="tel" className="w-full mt-1 p-2 border rounded" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700">
              {lang === 'ar' ? 'ابدأ الامتحان' : 'Start Exam'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (attempt.status !== 'in_progress') {
    const hasScore = attempt.score !== null && attempt.score !== undefined;
    const percentage = hasScore && attempt.max_score > 0
      ? Math.round((attempt.score / attempt.max_score) * 100)
      : null;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="absolute top-4 right-4">
           <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="px-3 py-1 bg-white shadow rounded-md text-sm font-medium">
             {lang === 'en' ? 'عربي' : 'English'}
           </button>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} className="" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {lang === 'ar' ? 'تم تسليم الامتحان بنجاح' : 'Exam Submitted Successfully'}
          </h2>
          <p className="text-gray-500 mb-6 text-sm">
            {lang === 'ar' ? 'تم حفظ وتوثيق إجاباتك على الخادم.' : 'Your answers have been securely recorded on the server.'}
          </p>

          {exam?.show_results && hasScore ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6">
              <p className="text-sm font-medium text-blue-700 mb-1">
                {lang === 'ar' ? 'درجتك النهائية' : 'Your Final Score'}
              </p>
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
                  <span>{lang === 'ar' ? 'أسئلة تمت الإجابة عليها' : 'Answered'}</span>
                </div>
                <div>
                  <span className="block font-semibold text-gray-700 text-sm">{attempt.unanswered_questions ?? '-'}</span>
                  <span>{lang === 'ar' ? 'أسئلة بدون إجابة' : 'Unanswered'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
              {lang === 'ar'
                ? 'سيتم مراجعة النتائج واعتمادها من قِبل إدارة الامتحان.'
                : 'Results will be reviewed and announced by the administration.'}
            </div>
          )}

          <div className="text-xs text-gray-400">
            {lang === 'ar' ? `امتحان: ${exam?.title}` : `Exam: ${exam?.title}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="font-bold text-xl text-gray-800 truncate flex-1">{exam?.title}</h1>
          <div className="flex items-center space-x-4">
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="px-3 py-1 bg-gray-100 rounded-md text-sm font-medium">
               {lang === 'en' ? 'عربي' : 'English'}
            </button>
            <div className={`flex items-center space-x-2 font-mono text-lg font-bold px-4 py-2 rounded-md ${timeLeft !== null && timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
              <Clock size={20} className={lang === 'ar' ? 'ml-2' : ''} />
              <span>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-semibold text-lg text-gray-800 mb-4 flex">
              <span className="text-blue-600 mx-2">{index + 1}.</span>
              {q.text}
            </h3>
            <div className="space-y-3">
              {q.options.map((opt: any) => (
                <label
                  key={opt.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${answers[q.id] === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt.id}
                    checked={answers[q.id] === opt.id}
                    onChange={() => handleAnswerSelect(q.id, opt.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`mx-3 text-gray-700`}>{opt.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className={`flex justify-between items-center pt-8 border-t ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
          <p className="text-gray-500">
            {lang === 'ar' ? `تمت الإجابة على ${Object.keys(answers).length} من أصل ${questions.length} سؤال` : `Answered ${Object.keys(answers).length} of ${questions.length} questions`}
          </p>
          <button
            onClick={handleManualSubmit}
            disabled={loading}
            className="bg-green-600 text-white px-8 py-3 rounded-md font-bold hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? (lang === 'ar' ? 'جاري التسليم...' : 'Submitting...') : (lang === 'ar' ? 'تسليم الامتحان' : 'Submit Exam')}
          </button>
        </div>
      </main>
    </div>
  );
}

// Temporary inline component for CheckCircle
const CheckCircle = ({ size, className }: { size: number; className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);
