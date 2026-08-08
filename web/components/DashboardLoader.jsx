import { Activity } from 'lucide-react';

export default function DashboardLoader({ isVisible }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0b] transition-opacity duration-300 ${
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {/* Animated outer ring */}
        <div className="absolute w-24 h-24 rounded-full border-t-2 border-r-2 border-indigo-500/80 animate-spin"></div>
        <div className="absolute w-24 h-24 rounded-full border-b-2 border-l-2 border-violet-500/80 animate-[spin_1.5s_linear_infinite_reverse]"></div>
        
        {/* Inner pulse */}
        <div className="w-16 h-16 bg-[#141416] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          <Activity className="w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
      </div>
      <p className="mt-8 text-sm font-medium text-[#a1a1aa] animate-pulse tracking-wide">
        Connecting to orchestrator...
      </p>
    </div>
  );
}
