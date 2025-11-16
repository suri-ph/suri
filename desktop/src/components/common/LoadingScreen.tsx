export default function LoadingScreen() {
  return (
    <div className="app-content-wrapper flex items-center justify-center bg-black">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-cyan-400 rounded-full border-t-transparent animate-spin"></div>
      </div>
    </div>
  );
}
