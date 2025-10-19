interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div className="px-6 py-2 bg-red-600/20 border-b border-red-500/40 text-red-200 flex items-center justify-between text-sm">
      <span>{error}</span>
      <button
        onClick={onDismiss}
        className="text-red-200 hover:text-red-100 transition-colors"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}

