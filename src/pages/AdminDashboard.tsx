import { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Book, Users } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
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

  if (loading) return <div className="p-8 text-gray-500 dark:text-slate-400">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-900 text-gray-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 shadow-md flex flex-col transition-colors duration-200">
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Admin Portal</h1>
          <ThemeToggle />
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/admin"
            className={`flex items-center space-x-2 w-full p-3 rounded-xl transition ${location.pathname === '/admin' || location.pathname.startsWith('/admin/exams') ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
          >
            <Book size={20} />
            <span>Exams</span>
          </Link>
          <Link
            to="/admin/results"
            className={`flex items-center space-x-2 w-full p-3 rounded-xl transition ${location.pathname.startsWith('/admin/results') ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
          >
            <Users size={20} />
            <span>Results</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-100 dark:border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 w-full p-2 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
        <Routes>
          <Route path="/" element={<ExamList />} />
          <Route path="/exams/:id" element={<ExamEditor />} />
          <Route path="/results" element={<ResultsViewer />} />
        </Routes>
      </div>
    </div>
  );
}
