'use client';

import { useState, useEffect } from 'react';
import { Activity, LogOut } from 'lucide-react';
import TaskForm from '@/components/TaskForm';
import TaskMonitor from '@/components/TaskMonitor';

export default function Home() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          setUsername(data.userId);
        }
      } catch (err) {
        console.error('Silent refresh failed', err);
      }
    };
    silentRefresh();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!inputName.trim() || !inputPassword.trim()) return;
    setAuthError('');
    setIsLoading(true);
    try {
      const endpoint = isRegistering ? '/api/register' : '/api/login';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: inputName, password: inputPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUsername(data.userId);
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Auth error', err);
      setAuthError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error('Logout error', e);
    }
    setToken(null);
    setUsername('');
  };

  if (!token) {
    return (
      <main className="min-h-screen py-16 px-4 flex items-center justify-center bg-[#0a0a0b]">
        <div className="bg-[#141416] border border-white/10 p-10 rounded-2xl w-full max-w-md shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <h1 className="text-2xl font-semibold text-[#fafafa] mb-8 text-center tracking-tight">
            NexusFlow {isRegistering ? 'Register' : 'Login'}
          </h1>
          <form onSubmit={handleAuth} className="space-y-5">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Username"
              className="w-full p-3.5 bg-[#0a0a0b] border border-white/10 rounded-xl text-sm text-[#fafafa] outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              required
            />
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3.5 bg-[#0a0a0b] border border-white/10 rounded-xl text-sm text-[#fafafa] outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              required
            />
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 disabled:opacity-70 disabled:hover:brightness-100 text-white text-sm p-3.5 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isRegistering ? 'Creating Account...' : 'Authenticating...'}
                </>
              ) : (
                isRegistering ? 'Create Account' : 'Enter Workspace'
              )}
            </button>
            <p className="text-slate-400 text-sm text-center mt-4 cursor-pointer hover:text-slate-300" onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center bg-[#0a0a0b] relative overflow-hidden">
      {/* Subtle top radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 relative z-10">
        
        {/* Left Column - Dispatcher */}
        <div className="flex-1 flex flex-col space-y-6 lg:max-w-md">
          <header className="mb-2 relative flex flex-col items-start">
            <button onClick={handleLogout} className="absolute right-0 top-0 flex items-center gap-2 text-xs bg-[#141416] border border-white/10 text-zinc-400 px-3 py-1.5 rounded-lg hover:text-zinc-200 transition-colors shadow-sm">
              <LogOut className="w-3 h-3" />
              Logout
            </button>
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-zinc-800/50 border border-white/5 text-zinc-400 text-xs font-medium tracking-wide uppercase">
              Distributed Architecture
            </div>
            <h1 className="text-4xl font-semibold text-[#fafafa] mb-3 tracking-tight">
              NexusFlow
            </h1>
            <p className="text-[#a1a1aa] text-sm leading-relaxed">
              Real-time dashboard for dispatching and monitoring BullMQ/Redis-backed jobs with priority levels.
            </p>
          </header>
          
          <TaskForm token={token} />
          
          <div className="bg-[#141416] border border-white/10 p-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.3)] flex items-center space-x-4">
            <Activity className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-[#fafafa]">System Status: Active</p>
              <p className="text-xs text-[#a1a1aa] mt-1">Workers are polling the Redis queue.</p>
            </div>
          </div>
        </div>

        {/* Right Column - Monitor */}
        <div className="flex-[1.2] flex flex-col">
          <TaskMonitor token={token} />
        </div>

      </div>
    </main>
  );
}