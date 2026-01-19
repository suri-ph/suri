import { useCallback } from "react";
import { useImageProcessing } from "../hooks/useImageProcessing";

interface UploadAreaProps {
  onFileProcessed: (dataUrl: string, width: number, height: number) => void;
  onError: (msg: string) => void;
}

export function UploadArea({ onFileProcessed, onError }: UploadAreaProps) {
  const { processImageFile } = useImageProcessing();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];

      if (!file.type.startsWith("image/")) {
        onError("Please upload a valid image file.");
        return;
      }

      try {
        const { dataUrl, width, height } = await processImageFile(file);
        onFileProcessed(dataUrl, width, height);
      } catch {
        onError("Failed to process the selected image.");
      }
      e.target.value = "";
    },
    [processImageFile, onFileProcessed, onError],
  );

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      <label className="h-full flex cursor-pointer flex-col items-center justify-center p-8 text-center hover:bg-white/5 transition-all group">
        <div className="flex flex-col items-center gap-4">
          <div>
            <div className="text-sm text-white/60 mb-1">
              Drop image or click to browse
            </div>
            <div className="text-xs text-white/30">PNG, JPG up to 10MB</div>
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}
