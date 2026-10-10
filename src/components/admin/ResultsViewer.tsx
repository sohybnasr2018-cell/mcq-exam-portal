import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

export default function ResultsViewer() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [loading, setLoading] = useState(true);

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
      a.students.full_name,
      a.students.university_code,
      a.students.phone_number,
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
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b text-sm">
              <th className="p-4 font-semibold text-gray-600">Student Name</th>
              <th className="p-4 font-semibold text-gray-600">ID / Code</th>
              <th className="p-4 font-semibold text-gray-600">Phone</th>
              <th className="p-4 font-semibold text-gray-600">Status</th>
              <th className="p-4 font-semibold text-gray-600">Score</th>
              <th className="p-4 font-semibold text-gray-600">Started At</th>
              <th className="p-4 font-semibold text-gray-600">Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {loading && selectedExam ? (
              <tr><td colSpan={7} className="p-4 text-center">Loading results...</td></tr>
            ) : attempts.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">No attempts found for this exam.</td></tr>
            ) : attempts.map(a => (
              <tr key={a.id} className="border-b hover:bg-gray-50 text-sm">
                <td className="p-4 font-medium">{a.students.full_name}</td>
                <td className="p-4 text-gray-600">{a.students.university_code}</td>
                <td className="p-4 text-gray-600">{a.students.phone_number}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
