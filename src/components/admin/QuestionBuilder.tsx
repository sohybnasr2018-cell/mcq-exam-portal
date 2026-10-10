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
    const { data: qData, error: qError } = await supabase.from('questions').select('*').eq('exam_id', examId).order('order_num');
    
    if (qError) {
      console.error(qError);
      setLoading(false);
      return;
    }

    if (!qData || qData.length === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    const { data: oData } = await supabase.from('options').in('question_id', qData.map(q => q.id));
    const { data: kData } = await supabase.from('question_keys').in('question_id', qData.map(q => q.id));

    const loadedQuestions = qData.map(q => {
      const qOptions = oData?.filter(o => o.question_id === q.id).map(o => ({
        id: o.id,
        text: o.text,
        is_correct: kData?.find(k => k.question_id === q.id)?.correct_option_id === o.id
      })) || [];
      return { id: q.id, text: q.text, marks: q.marks, options: qOptions };
    });

    setQuestions(loadedQuestions);
    setLoading(false);
  };

  const addQuestion = async () => {
    const { data: newQ, error } = await supabase.from('questions').insert({
      exam_id: examId,
      text: 'New Question',
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
      text: 'New Option',
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

  if (loading) return <div>Loading questions...</div>;

  return (
    <div className="space-y-6">
      {questions.map((q, index) => (
        <div key={q.id} className="border border-gray-200 p-4 rounded-md relative group">
          <div className="flex justify-between items-start mb-4">
            <h4 className="font-semibold text-gray-700">Question {index + 1}</h4>
            <button onClick={() => deleteQuestion(q.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition">
              <Trash2 size={18} />
            </button>
          </div>
          
          <textarea
            value={q.text}
            onChange={(e) => updateQuestionText(q.id, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mb-4"
            rows={2}
          />
          
          <div className="space-y-2 pl-4">
            {q.options.map((opt) => (
              <div key={opt.id} className="flex items-center space-x-2">
                <button
                  onClick={() => setCorrectOption(q.id, opt.id)}
                  className={`p-1 rounded-full ${opt.is_correct ? 'text-green-600 bg-green-100' : 'text-gray-400 bg-gray-100'}`}
                  title="Mark as correct"
                >
                  <CheckCircle2 size={20} />
                </button>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOptionText(opt.id, e.target.value)}
                  className="flex-1 p-2 border border-gray-200 rounded"
                />
                <button onClick={() => deleteOption(q.id, opt.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => addOption(q.id)}
              className="text-blue-600 text-sm flex items-center mt-2 hover:underline"
            >
              <Plus size={16} className="mr-1" /> Add Option
            </button>
          </div>
        </div>
      ))}
      
      <button
        onClick={addQuestion}
        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 flex items-center justify-center transition"
      >
        <Plus size={20} className="mr-2" /> Add New Question
      </button>
    </div>
  );
}
