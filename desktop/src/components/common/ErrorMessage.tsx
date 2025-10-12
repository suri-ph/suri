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
          <button onClick={onClose} className="text-red-200 hover:text-red-100 transition-colors">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
