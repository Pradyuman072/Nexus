export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0a0a0b]">
      {/* 
        Use standard CSS animations. We use motion-safe media queries in globals.css 
        to respect prefers-reduced-motion, but here we'll just set up the basic blobs. 
      */}
      <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/20 blur-[120px] mix-blend-screen animate-blob" />
      <div className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-violet-900/20 blur-[100px] mix-blend-screen animate-blob animation-delay-2000" />
      <div className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-900/10 blur-[150px] mix-blend-screen animate-blob animation-delay-4000" />
      
      {/* Subtle Grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDAuNWg0ME0wLjUgMHY0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] opacity-30" />
    </div>
  );
}
