import TaskForm from '@/components/TaskForm';
import TaskMonitor from '@/components/TaskMonitor'; // Import here

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-blue-900 mb-2">NexusFlow</h1>
          <p className="text-gray-600 font-medium italic">Distributed Task Orchestrator</p>
        </header>
        
        <TaskForm />
        <TaskMonitor /> {/* New Component */}
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-800">
            <strong>System Status:</strong> Real-time synchronization active.
          </p>
        </div>
      </div>
    </main>
  );
}