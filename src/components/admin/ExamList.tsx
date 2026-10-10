import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';

type Exam = {
  id: string;
  title: string;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
};

export default function ExamList() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setExams(data);
    setLoading(false);
  };

  const deleteExam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    await supabase.from('exams').delete().eq('id', id);
    fetchExams();
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    await supabase.from('exams').update({ is_published: !currentStatus }).eq('id', id);
    fetchExams();
  };

  if (loading) return <div className="p-8">Loading exams...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Manage Exams</h2>
        <Link
          to="/admin/exams/new"
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          <span>Create New Exam</span>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 font-semibold text-gray-600">Title</th>
              <th className="p-4 font-semibold text-gray-600">Duration</th>
              <th className="p-4 font-semibold text-gray-600">Status</th>
              <th className="p-4 font-semibold text-gray-600">Created</th>
              <th className="p-4 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">No exams found.</td>
              </tr>
            ) : exams.map((exam) => (
              <tr key={exam.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{exam.title}</td>
                <td className="p-4">{exam.duration_minutes} min</td>
                <td className="p-4">
                  <button
                    onClick={() => togglePublish(exam.id, exam.is_published)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      exam.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {exam.is_published ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="p-4 text-sm text-gray-500">
                  {format(new Date(exam.created_at), 'MMM d, yyyy')}
                </td>
                <td className="p-4 flex space-x-2">
                  <Link to={`/admin/exams/${exam.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md">
                    <Edit2 size={18} />
                  </Link>
                  <a href={`/exam/${exam.id}`} target="_blank" rel="noreferrer" className="p-2 text-green-600 hover:bg-green-50 rounded-md">
                    <Eye size={18} />
                  </a>
                  <button onClick={() => deleteExam(exam.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-md">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
