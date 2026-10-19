import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const applyTheme = (targetTheme: 'light' | 'dark') => {
    setTheme(targetTheme);
    try {
      localStorage.setItem('theme', targetTheme);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.setAttribute('content', targetTheme);
      }
      if (targetTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (_) {}
  };

  const toggleTheme = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Initial sync
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Sync across browser tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'تفعيل الوضع الفاتح (Light Mode)' : 'تفعيل الوضع الداكن (Dark Mode)'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer select-none ${
        isDark
          ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700/80 hover:text-amber-200 hover:border-slate-600 shadow-sm'
          : 'bg-white text-slate-700 border-gray-200 hover:bg-gray-100 hover:text-slate-900 hover:border-gray-300 shadow-xs'
      } ${className}`}
    >
      {isDark ? (
        <Sun size={15} className="animate-in spin-in-90 duration-200 text-amber-300" />
      ) : (
        <Moon size={15} className="animate-in spin-in-90 duration-200 text-slate-600" />
      )}
      {showLabel && (
        <span className="text-[11px] font-medium leading-none">
          {isDark ? 'فاتح' : 'داكن'}
        </span>
      )}
    </button>
  );
}
