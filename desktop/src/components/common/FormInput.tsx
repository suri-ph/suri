interface FormInputProps {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  focusColor?: string;
}

export function FormInput({ 
  type = "text", 
  value, 
  onChange, 
  placeholder, 
  disabled = false, 
  className = "",
  focusColor = "border-white/20"
}: FormInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:${focusColor} ${className}`}
    />
  );
}
