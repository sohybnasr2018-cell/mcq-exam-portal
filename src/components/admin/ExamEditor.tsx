import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import QuestionBuilder from './QuestionBuilder';

export default function ExamEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(60);
  const [showResults, setShowResults] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadExam();
    }
  }, [id]);

  const loadExam = async () => {
    const { data } = await supabase.from('exams').select('*').eq('id', id).single();
    if (data) {
      setTitle(data.title);
      setInstructions(data.instructions || '');
      setDuration(data.duration_minutes);
      setShowResults(data.show_results ?? false);
      setShowAnswers(data.show_answers ?? false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const examData: any = {
      title,
      instructions,
      duration_minutes: duration,
      show_results: showResults,
      show_answers: showAnswers
    };

    let examId = id;

    if (isNew) {
      const { data, error } = await supabase.from('exams').insert([examData]).select().single();
      if (error) {
        console.error('Insert error:', error);
        alert('حدث خطأ أثناء حفظ الامتحان: ' + error.message);
      } else if (data) {
        navigate(`/admin/exams/${data.id}`);
      }
    } else {
      const { error } = await supabase.from('exams').update(examData).eq('id', id);
      if (error) {
        console.error('Update error:', error);
        alert('حدث خطأ أثناء تحديث الامتحان: ' + error.message);
      }
    }
    
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/admin')} className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{isNew ? 'Create New Exam' : 'Edit Exam'}</h2>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6 transition-colors duration-200">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Exam Title</label>
          <input
            required
            type="text"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/60 text-gray-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Instructions (Optional)</label>
          <textarea
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/60 text-gray-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition h-24"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Duration (minutes)</label>
          <input
            required
            type="number"
            min="1"
            className="w-full md:w-1/3 px-4 py-2.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/60 text-gray-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
              checked={showResults}
              onChange={(e) => setShowResults(e.target.checked)}
            />
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
              إظهار النتيجة والدرجة للطالب فور تسليم الامتحان (Show score to student after submission)
            </span>
          </label>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 mr-8 ml-8 leading-relaxed">
            عند التفعيل، سيرى الطالب درجته النهائية والنسبة المئوية فور انتهاء الامتحان. إذا تم التعطيل، ستظهر رسالة تم التسليم فقط.
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 text-purple-600 rounded border-gray-300 dark:border-slate-600 focus:ring-purple-500 cursor-pointer"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
            />
            <span className="text-sm font-semibold text-purple-950 dark:text-purple-200">
              السماح للطالب بمراجعة أسئلة الامتحان كاملة وإجاباته وأخطائه (Show Full Exam & Review to Student)
            </span>
          </label>
          <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 mr-8 ml-8 leading-relaxed">
            (خيار منفصل عن النتيجة): عند التفعيل، يظهر زر للطالب بعد تسليم الامتحان يمكنه من فتح ورقة امتحانه كاملة ومراجعة كل سؤال، الإجابة التي اختارها، وتحديد أخطائه مع الإجابات النموذجية.
          </p>
        </div>

        {isNew && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-sm">
              1
            </div>
            <div>
              <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">الخطوة الأولى: حفظ بيانات الامتحان</h4>
              <p className="text-amber-800 dark:text-amber-300/80 text-xs mt-1 leading-relaxed">
                أدخل عنوان الامتحان والمدة واضغط على زر <strong>"حفظ الامتحان وبدء إضافة الأسئلة"</strong> بالأسفل. سيتم إنشاء الامتحان فوراً وفتح قسم إضافة الأسئلة والاختيارات مباشرة في نفس الصفحة.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 font-semibold shadow-sm cursor-pointer"
          >
            <Save size={18} />
            <span>
              {saving
                ? 'جاري الحفظ...'
                : isNew
                ? 'حفظ الامتحان وبدء إضافة الأسئلة (Save & Add Questions)'
                : 'حفظ التعديلات (Save Changes)'}
            </span>
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-200">
           <div className="mb-6 pb-3 border-b border-gray-100 dark:border-slate-700">
             <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">أسئلة الامتحان (Exam Questions)</h3>
             <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">أضف الأسئلة وحدد الإجابات الصحيحة للطلاب</p>
           </div>
           <QuestionBuilder examId={id!} />
        </div>
      )}
    </div>
  );
}
