"use client";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TextInput({
  value,
  onChange,
  disabled = false,
}: TextInputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="분석할 텍스트를 입력하세요..."
      className="textarea-input"
    />
  );
}
