import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Eye, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function ResultsViewer() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modal state for viewing student answers
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [attemptDetails, setAttemptDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      loadResults(selectedExam);
    } else {
      setAttempts([]);
    }
  }, [selectedExam]);

  const loadExams = async () => {
    const { data } = await supabase.from('exams').select('id, title, show_results, show_answers').order('created_at', { ascending: false });
    if (data) {
      setExams(data);
      if (data.length > 0) setSelectedExam(data[0].id);
    }
  };

  const currentExam = exams.find(e => e.id === selectedExam);

  const toggleStudentReview = async () => {
    if (!currentExam) return;
    const newStatus = !currentExam.show_answers;
    try {
      const { error } = await supabase.from('exams').update({ show_answers: newStatus }).eq('id', selectedExam);
      if (error) throw error;
      setExams(prev => prev.map(e => e.id === selectedExam ? { ...e, show_answers: newStatus } : e));
    } catch (err: any) {
      alert('تعذر تحديث إعداد المراجعة: ' + err.message);
    }
  };

  const loadResults = async (examId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('attempts')
      .select(`
        *,
        students (
          full_name,
          university_code,
          phone_number
        )
      `)
      .eq('exam_id', examId)
      .order('started_at', { ascending: false });
    
    if (data) setAttempts(data);
    setLoading(false);
  };

  const exportCSV = () => {
    if (attempts.length === 0) return;
    
    const headers = ['Student Name', 'University Code', 'Phone', 'Status', 'Score', 'Max Score', 'Tab Switches (مرات الخروج)', 'Screenshots (لقطات الشاشة)', 'Started At', 'Submitted At', 'Submission Type'];
    const rows = attempts.map(a => [
      a.students?.full_name ?? '',
      a.students?.university_code ?? '',
      a.students?.phone_number ?? '',
      a.status,
      a.score ?? '',
      a.max_score ?? '',
      a.tab_switches ?? a.violations ?? 0,
      a.screenshots ?? 0,
      a.started_at,
      a.submitted_at ?? '',
      a.submission_type ?? ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `exam_results_${selectedExam}_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open modal and fetch questions, options, correct keys, and student answers
  const openStudentAnswers = async (attempt: any) => {
    setSelectedAttempt(attempt);
    setLoadingDetails(true);
    setAttemptDetails([]);

    try {
      // 1. Fetch questions and options for this exam
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*, options(*)')
        .eq('exam_id', attempt.exam_id)
        .order('order_num');

      const qList = questionsData || [];
      const questionIds = qList.map(q => q.id);

      // 2. Fetch correct answers (question_keys)
      const keysMap: Record<string, string> = {};
      if (questionIds.length > 0) {
        const { data: keysData } = await supabase
          .from('question_keys')
          .select('question_id, correct_option_id')
          .in('question_id', questionIds);

        if (keysData) {
          keysData.forEach((k: any) => {
            keysMap[k.question_id] = k.correct_option_id;
          });
        }
      }

      // 3. Fetch student's answers for this attempt
      const { data: answersData } = await supabase
        .from('answers')
        .select('question_id, selected_option_id')
        .eq('attempt_id', attempt.id);

      const answersMap: Record<string, string> = {};
      if (answersData) {
        answersData.forEach((a: any) => {
          answersMap[a.question_id] = a.selected_option_id;
        });
      }

      // 4. Combine into single structured array
      const combined = qList.map(q => {
        const selectedOptionId = answersMap[q.id] || null;
        const correctOptionId = keysMap[q.id] || null;
        const isAnswered = selectedOptionId !== null;
        const isCorrect = isAnswered && selectedOptionId === correctOptionId;

        return {
          ...q,
          selectedOptionId,
          correctOptionId,
          isAnswered,
          isCorrect
        };
      });

      setAttemptDetails(combined);
    } catch (err) {
      console.error('Error loading student answers:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeAnswersModal = () => {
    setSelectedAttempt(null);
    setAttemptDetails([]);
  };

  // Summary counts for current viewed student
  const correctCount = attemptDetails.filter(q => q.isCorrect).length;
  const incorrectCount = attemptDetails.filter(q => q.isAnswered && !q.isCorrect).length;
  const unansweredCount = attemptDetails.filter(q => !q.isAnswered).length;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Exam Results</h2>
        <button
          onClick={exportCSV}
          disabled={attempts.length === 0}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <Download size={20} />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="mb-6 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4 transition-colors">
        <div className="flex items-center space-x-4">
          <label className="font-semibold text-gray-700 dark:text-slate-300">Select Exam:</label>
          <select
            className="p-2.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/60 text-gray-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px]"
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
          >
            <option value="" disabled>Select an exam</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>
        </div>

        {selectedExam && currentExam && (
          <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 px-4 py-2.5 rounded-xl">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
              إتاحة مراجعة الأسئلة والإجابات للطلاب:
            </span>
            <button
              type="button"
              onClick={toggleStudentReview}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                currentExam.show_answers
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
              }`}
            >
              <span>{currentExam.show_answers ? '🟢 مراجعة الامتحان مفعّلة للطلاب' : '⚪ مراجعة الامتحان معطلة (مخفية)'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden overflow-x-auto transition-colors">
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-slate-750 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700 text-sm">
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Student Name</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">ID / Code</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Phone</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Status</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Score</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">سجل الخروج ولقطات الشاشة</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Started At</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Submitted At</th>
              <th className="p-4 font-semibold text-gray-600 dark:text-slate-400">Answers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/70">
            {loading && selectedExam ? (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500 dark:text-slate-400">Loading results...</td></tr>
            ) : attempts.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500 dark:text-slate-400">No attempts found for this exam.</td></tr>
            ) : attempts.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-700/40 text-sm transition">
                <td className="p-4 font-semibold text-gray-900 dark:text-slate-100">{a.students?.full_name ?? '-'}</td>
                <td className="p-4 text-gray-600 dark:text-slate-300 font-mono text-xs">{a.students?.university_code ?? '-'}</td>
                <td className="p-4 text-gray-600 dark:text-slate-300 font-mono text-xs">{a.students?.phone_number ?? '-'}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    a.status === 'submitted' ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 
                    a.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}>
                    {a.status}
                  </span>
                </td>
                <td className="p-4 font-bold text-gray-900 dark:text-slate-100">
                  {a.score !== null ? `${a.score} / ${a.max_score}` : '-'}
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1 items-start whitespace-nowrap text-xs">
                    {(a.tab_switches ?? a.violations ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 font-semibold rounded-md">
                        📱 خروج: <strong>{a.tab_switches ?? a.violations}</strong> {(a.tab_switches ?? a.violations) === 1 ? 'مرة' : 'مرات'}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500 text-[11px]">📱 خروج: 0</span>
                    )}

                    {(a.screenshots ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 font-semibold rounded-md">
                        📸 لقطات: <strong>{a.screenshots}</strong>
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500 text-[11px]">📸 لقطات: 0</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-gray-500 dark:text-slate-400 whitespace-nowrap text-xs">
                  {format(new Date(a.started_at), 'MMM d, HH:mm:ss')}
                </td>
                <td className="p-4 text-gray-500 dark:text-slate-400 whitespace-nowrap text-xs">
                  {a.submitted_at ? format(new Date(a.submitted_at), 'MMM d, HH:mm:ss') : 'Not submitted yet'}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => openStudentAnswers(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>عرض الإجابات</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student Answers Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200 border border-gray-200 dark:border-slate-700">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-bold">{selectedAttempt.students?.full_name ?? 'Student'}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedAttempt.status === 'submitted' ? 'bg-green-500/20 text-green-300 border border-green-500/40' :
                    selectedAttempt.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                    'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    {selectedAttempt.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    📱 مرات الخروج: {selectedAttempt.tab_switches ?? selectedAttempt.violations ?? 0}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    📸 لقطات الشاشة: {selectedAttempt.screenshots ?? 0}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1.5 flex gap-4 flex-wrap">
                  <span>ID: {selectedAttempt.students?.university_code ?? '-'}</span>
                  <span>Phone: {selectedAttempt.students?.phone_number ?? '-'}</span>
                  <span>
                    Started: {format(new Date(selectedAttempt.started_at), 'MMM d, HH:mm')}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Score / النتيجة</p>
                  <p className="text-2xl font-black text-green-400">
                    {selectedAttempt.score !== null ? `${selectedAttempt.score} / ${selectedAttempt.max_score}` : '-'}
                  </p>
                </div>
                <button
                  onClick={closeAnswersModal}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-750 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-center py-2.5 text-xs font-semibold">
              <div className="text-slate-700 dark:text-slate-300">
                Total: <span className="text-slate-900 dark:text-slate-100 font-bold">{attemptDetails.length}</span>
              </div>
              <div className="text-green-700 dark:text-green-400">
                Correct: <span className="font-bold">{correctCount}</span>
              </div>
              <div className="text-red-700 dark:text-red-400">
                Incorrect: <span className="font-bold">{incorrectCount}</span>
              </div>
              <div className="text-gray-500 dark:text-slate-400">
                Unanswered: <span className="font-bold">{unansweredCount}</span>
              </div>
            </div>

            {/* Modal Body / Questions list */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50 dark:bg-slate-900/60">
              {loadingDetails ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
                  <p>جاري تحميل تفاصيل الإجابات...</p>
                </div>
              ) : attemptDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-slate-400">لا توجد أسئلة أو إجابات مسجلة لهذا الامتحان.</div>
              ) : (
                attemptDetails.map((q, idx) => (
                  <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 text-base leading-relaxed">{q.text}</h4>
                      </div>

                      {/* Question Status Badge */}
                      <div className="shrink-0">
                        {!q.isAnswered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-md text-xs font-semibold">
                            <AlertCircle size={13} />
                            لم يُجب (Unanswered)
                          </span>
                        ) : q.isCorrect ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-md text-xs font-semibold">
                            <CheckCircle2 size={13} />
                            إجابة صحيحة (+{q.marks})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-md text-xs font-semibold">
                            <XCircle size={13} />
                            إجابة خاطئة (0)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="space-y-2 mr-10 ml-10">
                      {q.options?.map((opt: any) => {
                        const isStudentChoice = opt.id === q.selectedOptionId;
                        const isCorrectAnswer = opt.id === q.correctOptionId;

                        let optClasses = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200';
                        let badge = null;

                        if (isCorrectAnswer && isStudentChoice) {
                          // Student chose correct
                          optClasses = 'border-green-500 bg-green-50/80 dark:bg-green-950/50 text-green-900 dark:text-green-200 font-medium';
                          badge = (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-300 font-bold bg-green-100 dark:bg-green-900/60 px-2 py-0.5 rounded">
                              <CheckCircle2 size={13} /> اختيار الطالب (صحيح)
                            </span>
                          );
                        } else if (isCorrectAnswer) {
                          // Correct answer (student missed it)
                          optClasses = 'border-green-500 bg-green-50/60 dark:bg-green-950/30 text-green-900 dark:text-green-200 font-medium';
                          badge = (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-300 font-bold bg-green-100 dark:bg-green-900/60 px-2 py-0.5 rounded">
                              <CheckCircle2 size={13} /> الإجابة الصحيحة
                            </span>
                          );
                        } else if (isStudentChoice) {
                          // Student chose wrong
                          optClasses = 'border-red-400 bg-red-50/80 dark:bg-red-950/50 text-red-900 dark:text-red-200 font-medium';
                          badge = (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300 font-bold bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded">
                              <XCircle size={13} /> اختيار الطالب (خاطئ)
                            </span>
                          );
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between p-3 border rounded-xl text-sm transition ${optClasses}`}
                          >
                            <span>{opt.text}</span>
                            {badge}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={closeAnswersModal}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                إغلاق (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
