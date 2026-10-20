import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface Option {
  id: string;
  text: string;
  is_correct: boolean; // Just for frontend state
}

interface Question {
  id: string;
  text: string;
  marks: number;
  options: Option[];
}

export default function QuestionBuilder({ examId }: { examId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, [examId]);

  const loadQuestions = async () => {
    try {
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_num');
      
      if (qError) {
        console.error('Error loading questions:', qError);
        return;
      }

      if (!qData || qData.length === 0) {
        setQuestions([]);
        return;
      }

      const qIds = qData.map(q => q.id);

      const { data: oData, error: oError } = await supabase
        .from('options')
        .select('*')
        .in('question_id', qIds);

      if (oError) {
        console.error('Error loading options:', oError);
      }

      const { data: kData, error: kError } = await supabase
        .from('question_keys')
        .select('*')
        .in('question_id', qIds);

      if (kError) {
        console.error('Error loading question keys:', kError);
      }

      const loadedQuestions = qData.map(q => {
        const qOptions = oData?.filter(o => o.question_id === q.id).map(o => ({
          id: o.id,
          text: o.text,
          is_correct: kData?.find(k => k.question_id === q.id)?.correct_option_id === o.id
        })) || [];
        return { id: q.id, text: q.text, marks: q.marks, options: qOptions };
      });

      setQuestions(loadedQuestions);
    } catch (err) {
      console.error('Unexpected error loading questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = async () => {
    const { data: newQ, error } = await supabase.from('questions').insert({
      exam_id: examId,
      text: '',
      marks: 1,
      order_num: questions.length
    }).select().single();

    if (error) {
      console.error(error);
      alert('حدث خطأ أثناء إضافة السؤال: ' + error.message);
    } else if (newQ) {
      setQuestions([...questions, { id: newQ.id, text: newQ.text, marks: newQ.marks, options: [] }]);
    }
  };

  const deleteQuestion = async (qId: string) => {
    await supabase.from('questions').delete().eq('id', qId);
    setQuestions(questions.filter(q => q.id !== qId));
  };

  const addOption = async (qId: string) => {
    const qIndex = questions.findIndex(q => q.id === qId);
    if (qIndex === -1) return;

    const { data: newOpt, error } = await supabase.from('options').insert({
      question_id: qId,
      text: '',
      order_num: questions[qIndex].options.length
    }).select().single();

    if (error) {
      console.error(error);
      alert('حدث خطأ أثناء إضافة الخيار: ' + error.message);
    } else if (newOpt) {
      const updated = [...questions];
      updated[qIndex].options.push({ id: newOpt.id, text: newOpt.text, is_correct: false });
      setQuestions(updated);
    }
  };

  const updateQuestionText = async (qId: string, text: string) => {
    await supabase.from('questions').update({ text }).eq('id', qId);
    setQuestions(questions.map(q => q.id === qId ? { ...q, text } : q));
  };

  const updateOptionText = async (oId: string, text: string) => {
    await supabase.from('options').update({ text }).eq('id', oId);
    setQuestions(questions.map(q => ({
      ...q,
      options: q.options.map(o => o.id === oId ? { ...o, text } : o)
    })));
  };

  const setCorrectOption = async (qId: string, oId: string) => {
    // Upsert the correct option key
    const { error } = await supabase.from('question_keys').upsert({
      question_id: qId,
      correct_option_id: oId
    });

    if (error) {
      console.error(error);
      alert('حدث خطأ أثناء تعيين الإجابة الصحيحة: ' + error.message);
    } else {
      setQuestions(questions.map(q => {
        if (q.id === qId) {
          return {
            ...q,
            options: q.options.map(o => ({ ...o, is_correct: o.id === oId }))
          };
        }
        return q;
      }));
    }
  };

  const deleteOption = async (qId: string, oId: string) => {
    await supabase.from('options').delete().eq('id', oId);
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { ...q, options: q.options.filter(o => o.id !== oId) };
      }
      return q;
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-slate-400 space-x-2">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
        <span className="text-sm">جاري تحميل الأسئلة... (Loading questions...)</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, index) => (
        <div key={q.id} className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 p-5 rounded-2xl relative group transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h4 className="font-bold text-gray-700 dark:text-slate-200">Question {index + 1}</h4>
            <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer" title="Delete Question">
              <Trash2 size={18} />
            </button>
          </div>
          
          <textarea
            value={q.text}
            onChange={(e) => updateQuestionText(q.id, e.target.value)}
            placeholder="Type your question here..."
            className="w-full p-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/60 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 dark:text-slate-100 transition"
            rows={2}
          />
          
          <div className="space-y-2.5 pl-2 sm:pl-4">
            {q.options.map((opt, optIndex) => (
              <div key={opt.id} className="flex items-center space-x-2">
                <button
                  onClick={() => setCorrectOption(q.id, opt.id)}
                  className={`p-1.5 rounded-full transition cursor-pointer shrink-0 ${opt.is_correct ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/60 ring-2 ring-green-500' : 'text-gray-400 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                  title={opt.is_correct ? "Correct answer" : "Click to mark as correct answer"}
                >
                  <CheckCircle2 size={18} />
                </button>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOptionText(opt.id, e.target.value)}
                  placeholder={`Option ${optIndex + 1}...`}
                  className="flex-1 p-2.5 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 dark:text-slate-100 transition"
                />
                <button onClick={() => deleteOption(q.id, opt.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer shrink-0" title="Delete option">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => addOption(q.id)}
              className="text-blue-600 dark:text-blue-400 text-sm font-semibold flex items-center mt-3 hover:underline cursor-pointer"
            >
              <Plus size={16} className="mr-1" /> Add Option
            </button>
          </div>
        </div>
      ))}
      
      <button
        onClick={addQuestion}
        className="w-full py-3.5 border-2 border-dashed border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/80 flex items-center justify-center font-semibold transition cursor-pointer"
      >
        <Plus size={20} className="mr-2" /> Add New Question
      </button>
    </div>
  );
}
