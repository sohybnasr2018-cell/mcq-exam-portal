export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 md:p-12">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MCQ Examination Portal</h1>
          <p className="text-lg text-gray-500">Setup Required</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <span className="text-amber-500 text-xl mr-3">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Supabase Not Connected</h3>
              <p className="text-amber-700 text-sm">
                The application needs a Supabase project to work. Follow the steps below to connect it.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-start">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</span>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-800 mb-1">Create a Supabase Project</h3>
              <p className="text-gray-600 text-sm mb-2">
                Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">supabase.com</a> and create a free account, then create a new project.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</span>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-800 mb-1">Run the Database Migration</h3>
              <p className="text-gray-600 text-sm mb-2">
                In the Supabase SQL Editor, run the SQL from the file:
              </p>
              <code className="bg-gray-100 px-3 py-1.5 rounded text-xs text-gray-700 block break-all">
                supabase/migrations/20261010000000_initial_schema.sql
              </code>
            </div>
          </div>

          <div className="flex items-start">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">3</span>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-800 mb-1">Add Environment Variables</h3>
              <p className="text-gray-600 text-sm mb-2">
                Create a file called <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">client/</code> folder with:
              </p>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono leading-relaxed">
                <div>VITE_SUPABASE_URL=<span className="text-gray-400">your-project-url</span></div>
                <div>VITE_SUPABASE_ANON_KEY=<span className="text-gray-400">your-anon-key</span></div>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                Find these in your Supabase Dashboard → Settings → API
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">4</span>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-800 mb-1">Restart the Dev Server</h3>
              <p className="text-gray-600 text-sm">
                After saving the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> file, restart the dev server. The application will connect automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-400 text-sm">MCQ Examination Portal • Built with React + Supabase</p>
        </div>
      </div>
    </div>
  );
}
