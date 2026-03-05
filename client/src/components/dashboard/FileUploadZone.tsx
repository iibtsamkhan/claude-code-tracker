import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileJson, Loader2 } from "lucide-react";

interface FileUploadZoneProps {
  onFileUpload: (file: File) => Promise<void>;
  isLoading: boolean;
}

export function FileUploadZone({ onFileUpload, isLoading }: FileUploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await onFileUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      await onFileUpload(files[0]);
    }
  };

  return (
    <Card
      className={`p-12 border-2 border-dashed transition-colors cursor-pointer ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : (
            <Upload className="w-12 h-12 text-muted-foreground" />
          )}
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-2">
            {isLoading ? "Processing file..." : "Upload AI Usage History"}
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop your JSON history file here, or click to browse
          </p>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm">
            <FileJson className="w-4 h-4" />
            Claude
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm">
            <FileJson className="w-4 h-4" />
            OpenAI
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm">
            <FileJson className="w-4 h-4" />
            Gemini
          </div>
        </div>

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="mt-4"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Select File
            </>
          )}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isLoading}
        />

        <p className="text-xs text-muted-foreground pt-4">
          Data is only sent to this app backend for your account storage and is never forwarded to third-party services.
        </p>
      </div>
    </Card>
  );
}
