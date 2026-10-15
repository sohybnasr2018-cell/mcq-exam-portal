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
    const { data } = await supabase.from('exams').select('id, title').order('created_at', { ascending: false });
    if (data) {
      setExams(data);
      if (data.length > 0) setSelectedExam(data[0].id);
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
    
    const headers = ['Student Name', 'University Code', 'Phone', 'Status', 'Score', 'Max Score', 'Started At', 'Submitted At', 'Submission Type'];
    const rows = attempts.map(a => [
      a.students?.full_name ?? '',
      a.students?.university_code ?? '',
      a.students?.phone_number ?? '',
      a.status,
      a.score ?? '',
      a.max_score ?? '',
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
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Exam Results</h2>
        <button
          onClick={exportCSV}
          disabled={attempts.length === 0}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
        >
          <Download size={20} />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
        <label className="font-medium text-gray-700">Select Exam:</label>
        <select
          className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 min-w-[200px]"
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
        >
          <option value="" disabled>Select an exam</option>
          {exams.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.title}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b text-sm">
              <th className="p-4 font-semibold text-gray-600">Student Name</th>
              <th className="p-4 font-semibold text-gray-600">ID / Code</th>
              <th className="p-4 font-semibold text-gray-600">Phone</th>
              <th className="p-4 font-semibold text-gray-600">Status</th>
              <th className="p-4 font-semibold text-gray-600">Score</th>
              <th className="p-4 font-semibold text-gray-600">Started At</th>
              <th className="p-4 font-semibold text-gray-600">Submitted At</th>
              <th className="p-4 font-semibold text-gray-600">Answers</th>
            </tr>
          </thead>
          <tbody>
            {loading && selectedExam ? (
              <tr><td colSpan={8} className="p-4 text-center">Loading results...</td></tr>
            ) : attempts.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-gray-500">No attempts found for this exam.</td></tr>
            ) : attempts.map(a => (
              <tr key={a.id} className="border-b hover:bg-gray-50 text-sm">
                <td className="p-4 font-medium">{a.students?.full_name ?? '-'}</td>
                <td className="p-4 text-gray-600">{a.students?.university_code ?? '-'}</td>
                <td className="p-4 text-gray-600">{a.students?.phone_number ?? '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    a.status === 'submitted' ? 'bg-green-100 text-green-700' : 
                    a.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {a.status}
                  </span>
                </td>
                <td className="p-4 font-semibold">
                  {a.score !== null ? `${a.score} / ${a.max_score}` : '-'}
                </td>
                <td className="p-4 text-gray-500 whitespace-nowrap">
                  {format(new Date(a.started_at), 'MMM d, HH:mm:ss')}
                </td>
                <td className="p-4 text-gray-500 whitespace-nowrap">
                  {a.submitted_at ? format(new Date(a.submitted_at), 'MMM d, HH:mm:ss') : 'Not submitted yet'}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => openStudentAnswers(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition whitespace-nowrap"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
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
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 bg-slate-100 border-b border-slate-200 text-center py-2.5 text-xs font-semibold">
              <div className="text-slate-700">
                Total: <span className="text-slate-900 font-bold">{attemptDetails.length}</span>
              </div>
              <div className="text-green-700">
                Correct: <span className="font-bold">{correctCount}</span>
              </div>
              <div className="text-red-700">
                Incorrect: <span className="font-bold">{incorrectCount}</span>
              </div>
              <div className="text-gray-500">
                Unanswered: <span className="font-bold">{unansweredCount}</span>
              </div>
            </div>

            {/* Modal Body / Questions list */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
              {loadingDetails ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
                  <p>جاري تحميل تفاصيل الإجابات...</p>
                </div>
              ) : attemptDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-500">لا توجد أسئلة أو إجابات مسجلة لهذا الامتحان.</div>
              ) : (
                attemptDetails.map((q, idx) => (
                  <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <h4 className="font-medium text-slate-900 text-base leading-relaxed">{q.text}</h4>
                      </div>

                      {/* Question Status Badge */}
                      <div className="shrink-0">
                        {!q.isAnswered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold">
                            <AlertCircle size={13} />
                            لم يُجب (Unanswered)
                          </span>
                        ) : q.isCorrect ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-semibold">
                            <CheckCircle2 size={13} />
                            إجابة صحيحة (+{q.marks})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
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

                        let optClasses = 'border-slate-200 bg-white text-slate-700';
                        let badge = null;

                        if (isCorrectAnswer && isStudentChoice) {
                          // Student chose correct
                          optClasses = 'border-green-500 bg-green-50/80 text-green-900 font-medium';
                          badge = (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded">
                              <CheckCircle2 size={13} /> اختيار الطالب (صحيح)
                            </span>
                          );
                        } else if (isCorrectAnswer) {
                          // Correct answer (student missed it)
                          optClasses = 'border-green-500 bg-green-50/60 text-green-900 font-medium';
                          badge = (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded">
                              <CheckCircle2 size={13} /> الإجابة الصحيحة
                            </span>
                          );
                        } else if (isStudentChoice) {
                          // Student chose wrong
                          optClasses = 'border-red-400 bg-red-50/80 text-red-900 font-medium';
                          badge = (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded">
                              <XCircle size={13} /> اختيار الطالب (خاطئ)
                            </span>
                          );
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between p-3 border rounded-lg text-sm transition ${optClasses}`}
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
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={closeAnswersModal}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold transition"
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
