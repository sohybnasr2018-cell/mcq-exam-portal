import { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Book, Users } from 'lucide-react';
import ExamList from '../components/admin/ExamList';
import ExamEditor from '../components/admin/ExamEditor';
import ResultsViewer from '../components/admin/ResultsViewer';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/admin/login');
      }
      setLoading(false);
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">Admin Portal</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/admin"
            className={`flex items-center space-x-2 w-full p-3 rounded-md transition ${location.pathname === '/admin' || location.pathname.startsWith('/admin/exams') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Book size={20} />
            <span>Exams</span>
          </Link>
          <Link
            to="/admin/results"
            className={`flex items-center space-x-2 w-full p-3 rounded-md transition ${location.pathname.startsWith('/admin/results') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Users size={20} />
            <span>Results</span>
          </Link>
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-gray-600 hover:text-red-600 w-full p-2 transition"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<ExamList />} />
          <Route path="/exams/:id" element={<ExamEditor />} />
          <Route path="/results" element={<ResultsViewer />} />
        </Routes>
      </div>
    </div>
  );
}
