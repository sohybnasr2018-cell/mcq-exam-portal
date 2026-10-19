import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors" dir="rtl">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={30} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 leading-relaxed">
              واجه التطبيق مشكلة أثناء تحميل الصفحة. يرجى الضغط على الزر أدناه لإعادة تحميل الصفحة.
            </p>
            {this.state.error && (
              <div className="bg-gray-100 dark:bg-slate-700/60 text-gray-700 dark:text-slate-200 text-xs p-3 rounded-lg font-mono mb-6 text-left break-words max-h-32 overflow-auto" dir="ltr">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              <span>إعادة تحميل الصفحة (Reload)</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
