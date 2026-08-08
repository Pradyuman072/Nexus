'use client';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Trash2, CheckCircle2, XCircle, AlertCircle, List, Loader2 } from 'lucide-react';

export default function TaskMonitor({ token }) {
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const socket = io(apiUrl, {
            auth: { token }
        });

        socket.on('connect', () => {
            setError(false);
            setErrorMsg(null);
        });

        socket.on('connect_error', (err) => {
            console.error("Socket connection error:", err);
            setError(true);
            setErrorMsg(err.message || 'Failed to connect to orchestrator.');
        });

        socket.on('task_update', (data) => {
            setTasks(data);
            setError(false);
            setErrorMsg(null);
        });

        socket.on('redis_error', (data) => {
            setError(true);
            setErrorMsg(data.message || 'Redis is currently unavailable');
        });

        return () => {
            socket.disconnect();
        };
    }, [token]);

    const clearQueue = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tasks`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) {
                const data = await res.json();
                setError(true);
                setErrorMsg(data.error || 'Failed to clear queue');
            }
        } catch (err) {
            console.error("Failed to clear queue", err);
        }
    };

    return (
        <div className="bg-[#141416] border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
            <div className="bg-[#141416] px-6 py-5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#a1a1aa]" />
                    <h3 className="text-sm font-semibold text-[#fafafa] tracking-tight">Live Execution Log</h3>
                </div>
                <button 
                    onClick={clearQueue}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] hover:text-[#ef4444] transition-colors px-2 py-1 rounded-md hover:bg-[#ef4444]/10"
                    title="Clear all tasks from Redis"
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Queue</span>
                </button>
            </div>
            
            <div className="divide-y divide-white/5 flex-1 overflow-y-auto min-h-[300px]">
                {error && (
                    <div className="p-8 text-[#ef4444] text-center flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6" />
                        <p className="text-sm font-medium">{errorMsg || 'Failed to connect to orchestrator.'}</p>
                    </div>
                )}
                
                {!error && tasks.length === 0 && (
                    <div className="p-12 text-slate-500 text-center flex flex-col items-center gap-3">
                        <List className="w-6 h-6 text-[#a1a1aa]/50" />
                        <p className="text-sm font-medium">Queue is empty. Dispatch a task.</p>
                    </div>
                )}
                
                {!error && tasks.map((task) => {
                    let badgeClass = 'bg-white/5 text-[#a1a1aa]'; // default/queued
                    if (task.status === 'Completed') badgeClass = 'bg-[#22c55e]/10 text-[#22c55e]';
                    else if (task.status === 'Failed') badgeClass = 'bg-[#ef4444]/10 text-[#ef4444]';
                    else if (task.status === 'Processing') badgeClass = 'bg-[#6366f1]/10 text-[#6366f1]';
                    else if (task.status === 'Stalled' || task.status === 'Retrying') badgeClass = 'bg-amber-500/10 text-amber-500';

                    return (
                        <div key={task.id} className="p-5 flex justify-between items-center hover:bg-white/5 transition-colors group">
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="text-sm font-medium text-[#fafafa] truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-[#a1a1aa] font-mono">
                                        ID: {task.id}
                                    </span>
                                </div>
                            </div>
                        
                            <div className="flex-shrink-0">
                                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${badgeClass}`}>
                                    {task.status === 'Processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {task.status === 'Completed' && <CheckCircle2 className="w-3 h-3" />}
                                    {task.status === 'Failed' && <XCircle className="w-3 h-3" />}
                                    {task.status}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}