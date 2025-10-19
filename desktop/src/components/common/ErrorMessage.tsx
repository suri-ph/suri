interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onClose, className = "" }: ErrorMessageProps) {
  return (
    <div className={`px-4 py-2 bg-red-600/20 border border-red-500/40 text-red-200 rounded-lg text-sm ${className}`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        {onClose && (
          <button onClick={onClose} className="text-red-200 hover:text-red-100 transition-colors group">
            <div className="relative w-3 h-3">
              <div className="absolute top-1/2 left-1/2 w-2 h-0.5 bg-red-200 group-hover:bg-red-100 transition-all duration-200 rotate-45 -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-2 h-0.5 bg-red-200 group-hover:bg-red-100 transition-all duration-200 -rotate-45 -translate-x-1/2 -translate-y-1/2"></div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
