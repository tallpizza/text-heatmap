"use client";

import { useRef } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ".txt,.pdf,.docx";
const MAX_FILE_SIZE_MB = 100;

export default function FileUpload({
  onFileSelect,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      alert(`파일이 너무 큽니다. 최대 ${MAX_FILE_SIZE_MB}MB까지 가능합니다.`);
      return;
    }

    onFileSelect(file);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="btn-secondary"
      >
        파일 업로드
      </button>
    </>
  );
}
