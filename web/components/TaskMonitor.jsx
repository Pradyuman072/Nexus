'use client';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Trash2, CheckCircle2, XCircle, AlertCircle, List, Loader2 } from 'lucide-react';

export default function TaskMonitor({ token, onReady }) {
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
            if (onReady) onReady();
        });

        socket.on('task_update', (data) => {
            setTasks(data);
            setError(false);
            setErrorMsg(null);
            if (onReady) onReady();
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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
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
        <div className="bg-[#141416]/60 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all rounded-2xl overflow-hidden flex flex-col h-full shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite]" />
            <div className="bg-[#141416]/40 px-6 py-5 border-b border-white/5 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white tracking-tight">Live Execution Log</h3>
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
                                <p className="text-sm font-medium text-white truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-zinc-500 font-mono group-hover:text-zinc-400 transition-colors">
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