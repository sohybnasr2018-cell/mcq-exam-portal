import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabase';
import AdminDashboard from './pages/AdminDashboard';
import ExamPortal from './pages/ExamPortal';
import AdminLogin from './pages/AdminLogin';
import SetupGuide from './pages/SetupGuide';

function App() {
  if (!isSupabaseConfigured) {
    return <SetupGuide />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/exam/:examId" element={<ExamPortal />} />
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
