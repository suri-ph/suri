interface FormTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  focusColor?: string;
  minHeight?: string;
}

export function FormTextarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  focusColor = "border-white/20",
  minHeight = "min-h-[80px]",
}: FormTextareaProps) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:${focusColor} ${minHeight} ${className}`}
    />
  );
}
