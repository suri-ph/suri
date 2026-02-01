export function AppSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-black">
      <div className="flex-1 flex min-h-0">
        {/* Main Content Area (Video Placeholder) */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 m-4 rounded-3xl border border-white/5 bg-white/5 flex items-center justify-center">
            <div className="text-white/20 flex flex-col items-center gap-4">
              <i className="fa-solid fa-camera text-4xl" />
            </div>
          </div>

          {/* Control Bar Placeholder */}
          <div className="mx-4 mb-4 min-h-[4rem] flex items-center justify-between gap-4">
            {/* Camera Dropdown Placeholder */}
            <div className="w-48 h-10 bg-white/5 border border-white/10 rounded-lg" />

            {/* Start Button Placeholder */}
            <div className="w-40 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-lg" />
          </div>
        </div>

        {/* Sidebar Placeholder */}
        <div className="w-[360px] border-l border-white/10 bg-[#0a0a0a] flex flex-col p-4 gap-4">
          <div className="h-10 w-full bg-white/5 rounded-xl" />
          <div className="h-32 w-full bg-white/5 rounded-xl border border-white/5" />
          <div className="flex-1 w-full bg-white/5 rounded-xl border border-white/5 opacity-50" />
        </div>
      </div>
    </div>
  );
}
