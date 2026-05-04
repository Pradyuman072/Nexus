'use client';
import { useState } from 'react';

export default function TaskForm() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const sendErrorTask = async () => {
    setLoading(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'FAIL: Critical System Update', priority: 'Urgent' }),
    });
    setLoading(false);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority: 'High' }),
      });

      if (response.ok) {
        alert('Task sent to NexusFlow!');
        setTitle('');
      }
    } catch (error) {
      console.error('Failed to send task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-md space-y-4 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800">Dispatch New Task</h2>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter task name (e.g., Image Resize)"
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300"
      >
        {loading ? 'Queueing...' : 'Add to Queue'}
      </button>
      <button
        type="button"
        onClick={sendErrorTask}
        className="w-full bg-red-100 text-red-700 p-3 rounded-lg font-semibold hover:bg-red-200 border border-red-300 transition-colors"
      >
        Trigger Faulty Task (Testing)
      </button>
    </form>
  );
}