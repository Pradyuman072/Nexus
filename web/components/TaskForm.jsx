import { useState } from 'react';
import { Plus, AlertTriangle, Loader2 } from 'lucide-react';

export default function TaskForm({ token }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const showStatus = (text, type) => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const sendErrorTask = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title: 'FAIL: Critical System Update', priority: 'Urgent' }),
      });
      if (response.ok) {
        showStatus('Faulty task dispatched (Simulation)', 'success');
      } else {
        const data = await response.json();
        showStatus(data.error || 'Failed to dispatch task', 'error');
      }
    } catch (err) {
      showStatus('Network error', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title, priority }),
      });

      if (response.ok) {
        showStatus('Task queued successfully', 'success');
        setTitle('');
      } else {
        const data = await response.json();
        showStatus(data.error || 'Failed to queue task', 'error');
      }
    } catch (error) {
      showStatus('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#141416]/60 backdrop-blur-xl border border-white/10 hover:border-white/20 p-8 rounded-2xl relative overflow-hidden transition-all shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
      <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1 tracking-tight">Dispatch New Task</h2>
          <p className="text-sm text-zinc-400">Add a job to the distributed queue.</p>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Process video rendering..."
              className="flex-1 p-4 bg-[#0a0a0b] border border-white/10 rounded-xl text-sm text-[#fafafa] outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
              required
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="p-4 bg-[#0a0a0b] border border-white/10 rounded-xl text-sm text-[#fafafa] outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 text-white p-4 rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Queueing...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add to Queue</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-5 border-t border-white/5 flex gap-3">
          <button
            type="button"
            onClick={sendErrorTask}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-transparent border border-red-900/50 hover:bg-[#ef4444] hover:border-[#ef4444] text-[#ef4444] hover:text-white p-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Trigger Fault</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const pwd = window.prompt("Enter Demo Password:");
              if (!pwd) return;

              setLoading(true);
              try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/demo-seed`, { 
                  method: 'POST', 
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                  },
                  body: JSON.stringify({ password: pwd })
                });
                const data = await res.json();
                if (res.ok) showStatus('Demo batch seeded!', 'success');
                else showStatus(data.error || 'Failed to seed demo', 'error');
              } catch (e) {
                showStatus('Network error', 'error');
              }
              setLoading(false);
            }}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-transparent border border-amber-900/50 hover:bg-amber-500 hover:border-amber-500 text-amber-500 hover:text-white p-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Seed Demo Batch</span>
          </button>
        </div>

        {statusMsg && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border z-50 flex items-center gap-2 ${
            statusMsg.type === 'success' ? 'bg-[#141416] border-[#22c55e]/20 text-[#22c55e]' : 'bg-[#141416] border-[#ef4444]/20 text-[#ef4444]'
          }`}>
            {statusMsg.text}
          </div>
        )}
      </form>
    </div>
  );
}