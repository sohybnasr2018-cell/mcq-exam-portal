import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Eye, Users, Clock, Trophy } from 'lucide-react';
import { format } from 'date-fns';

type ExamStats = {
  submitted: number;
  in_progress: number;
  full_score: number;
};

type Exam = {
  id: string;
  title: string;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
  stats?: ExamStats;
};

export default function ExamList() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    const { data: examData } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (!examData) { setLoading(false); return; }

    // Fetch attempts for all exams in one query
    const examIds = examData.map(e => e.id);
    let attemptsData: any[] = [];

    if (examIds.length > 0) {
      const { data } = await supabase
        .from('attempts')
        .select('exam_id, status, score, max_score')
        .in('exam_id', examIds);
      attemptsData = data || [];
    }

    // Calculate stats per exam
    const examsWithStats = examData.map(exam => {
      const examAttempts = attemptsData.filter(a => a.exam_id === exam.id);
      const submitted = examAttempts.filter(a => a.status === 'submitted' || a.status === 'expired').length;
      const in_progress = examAttempts.filter(a => a.status === 'in_progress').length;
      const full_score = examAttempts.filter(
        a => a.score !== null && a.max_score !== null && a.max_score > 0 && a.score === a.max_score
      ).length;

      return { ...exam, stats: { submitted, in_progress, full_score } };
    });

    setExams(examsWithStats);
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

      <div className="space-y-4">
        {exams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No exams found.</div>
        ) : exams.map((exam) => (
          <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-4 flex-wrap">

              {/* Left: title + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="text-lg font-bold text-gray-800 truncate">{exam.title}</h3>
                  <button
                    onClick={() => togglePublish(exam.id, exam.is_published)}
                    className={`px-3 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                      exam.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {exam.is_published ? 'Published' : 'Draft'}
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  {exam.duration_minutes} min &nbsp;·&nbsp; Created {format(new Date(exam.created_at), 'MMM d, yyyy')}
                </p>
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/admin/exams/${exam.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                  <Edit2 size={18} />
                </Link>
                <a href={`/exam/${exam.id}`} target="_blank" rel="noreferrer" className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Student Link">
                  <Eye size={18} />
                </a>
                <button onClick={() => deleteExam(exam.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {/* Submitted */}
              <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <Users size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-green-700 leading-none">{exam.stats?.submitted ?? 0}</p>
                  <p className="text-xs text-green-600 mt-0.5">سلّموا الامتحان</p>
                </div>
              </div>

              {/* In progress */}
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-blue-700 leading-none">{exam.stats?.in_progress ?? 0}</p>
                  <p className="text-xs text-blue-600 mt-0.5">يمتحنون الآن</p>
                </div>
              </div>

              {/* Full score */}
              <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3">
                <div className="w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
                  <Trophy size={16} className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-yellow-700 leading-none">{exam.stats?.full_score ?? 0}</p>
                  <p className="text-xs text-yellow-600 mt-0.5">حصلوا على الدرجة الكاملة</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
