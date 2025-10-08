export default function LoadingScreen() {
  return (
    <div className="app-content-wrapper flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        {/* spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    </div>
  );
}

