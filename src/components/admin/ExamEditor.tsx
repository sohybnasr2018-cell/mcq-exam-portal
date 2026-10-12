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
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const examData = {
      title,
      instructions,
      duration_minutes: duration,
      show_results: showResults
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
          <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{isNew ? 'Create New Exam' : 'Edit Exam'}</h2>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title</label>
          <input
            required
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (Optional)</label>
          <textarea
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-24"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
          <input
            required
            type="number"
            min="1"
            className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={showResults}
              onChange={(e) => setShowResults(e.target.checked)}
            />
            <span className="text-sm font-semibold text-gray-800">
              إظهار النتيجة والدرجة للطالب فور تسليم الامتحان (Show score to student after submission)
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 mr-8 ml-8">
            عند التفعيل، سيرى الطالب درجته النهائية والنسبة المئوية فور انتهاء الامتحان. إذا تم التعطيل، ستظهر رسالة تم التسليم فقط.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save size={20} />
            <span>{saving ? 'Saving...' : 'Save Exam Details'}</span>
          </button>
        </div>
      </form>

      {/* Note: In a complete implementation, Question Editor goes here. For brevity, it would manage questions, options, and question_keys using RPCs or RLS bypassing. */}
      {!isNew && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm">
           <h3 className="text-xl font-bold mb-4">Questions</h3>
           <QuestionBuilder examId={id!} />
        </div>
      )}
    </div>
  );
}
