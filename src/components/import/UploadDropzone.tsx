import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  onFiles,
}: {
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (files: File[]) => {
    if (files.length === 0) return;
    setFileNames(files.map((f) => f.name));
    onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle([...e.dataTransfer.files]);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group cursor-pointer rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-10 text-center transition-all duration-200 select-none",
        "hover:border-primary/50 hover:bg-surface/60",
        dragging && "border-primary bg-primary/5 scale-[1.01] ring-2 ring-primary/20",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".log,.txt,text/plain"
        multiple
        className="hidden"
        onChange={(e) => {
          handle(e.target.files ? [...e.target.files] : []);
          // Allow re-selecting the same file(s) later without needing a different pick first.
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "mx-auto flex h-9 w-9 items-center justify-center rounded-md bg-surface text-muted-foreground mb-3 transition-all duration-200 group-hover:text-foreground group-hover:-translate-y-0.5",
          dragging && "text-primary -translate-y-1 scale-110",
        )}
      >
        <Upload className="h-4 w-4" />
      </div>
      <div className="text-sm text-foreground/80 mb-1">
        {fileNames.length > 0 ? (
          fileNames.length === 1 ? (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              {fileNames[0]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              {fileNames.length} files selected
            </span>
          )
        ) : (
          "Drop file(s) or click to browse"
        )}
      </div>
      <div className="text-xs text-muted-foreground">.log · .txt</div>
    </div>
  );
}
