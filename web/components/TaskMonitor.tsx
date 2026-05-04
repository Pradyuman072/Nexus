'use client';
import { useState, useEffect } from 'react';

interface Task {
    id: string;
    title: string;
    status: string;
    priority: string;
}

export default function TaskMonitor() {
    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`);
            const data = await response.json();
            setTasks(data);
        } catch (err) {
            console.error("Failed to sync with NexusFlow", err);
        }
    };

    // Poll every 2 seconds
    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mt-8 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-700">Live Orchestration Monitor</h3>
            </div>
            <div className="divide-y divide-gray-100">
                {tasks.length === 0 && <p className="p-6 text-gray-400 text-center">No tasks in queue...</p>}
                {tasks.map((task) => (
                    <div key={task.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <div>
                            <p className="font-medium text-gray-900">{task.title}</p>
                            <p className="text-xs text-gray-500">ID: {task.id}</p>
                        </div>
                    
            
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                task.status === 'Failed' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700 animate-pulse'
                            }`}>
                            {task.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}