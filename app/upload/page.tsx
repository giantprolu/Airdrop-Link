"use client";

import { useState, useRef, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import { compressImage } from "@/lib/image-compression";

interface SelectedFile {
  file: File;
  preview: string | null;
}

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [compressImages, setCompressImages] = useState(true);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    setSuccess(null);

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedFiles((prev) => [
            ...prev,
            { file, preview: reader.result as string },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        setSelectedFiles((prev) => [...prev, { file, preview: null }]);
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
  };

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Compress images if enabled
      let filesToUpload = selectedFiles.map((sf) => sf.file);

      if (compressImages) {
        setCompressing(true);
        const compressedFiles: File[] = [];
        for (const sf of selectedFiles) {
          try {
            const compressed = await compressImage(sf.file, {
              maxWidth: 2048,
              maxHeight: 2048,
              quality: 0.85,
              maxSizeMB: 10,
            });
            compressedFiles.push(compressed);
          } catch {
            compressedFiles.push(sf.file);
          }
        }
        filesToUpload = compressedFiles;
        setCompressing(false);
      }

      const formData = new FormData();
      filesToUpload.forEach((file) => {
        formData.append("files", file);
      });
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      const uploadedCount = data.uploaded?.length || 0;
      const errorCount = data.errors?.length || 0;

      if (uploadedCount > 0) {
        setSuccess(
          `${uploadedCount} fichier(s) uploadé(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}`
        );
        setSelectedFiles([]);
        setDescription("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }

      if (data.errors && data.errors.length > 0) {
        setError(data.errors.join("\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setDescription("");
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setClearAllDialogOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼️";
    if (type.startsWith("video/")) return "🎬";
    if (type.startsWith("audio/")) return "🎵";
    if (type.includes("pdf")) return "📄";
    if (type.includes("zip") || type.includes("rar")) return "📦";
    if (type.includes("word") || type.includes("document")) return "📝";
    if (type.includes("sheet") || type.includes("excel")) return "📊";
    return "📎";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Minimal header */}
      <header className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
        <Link href="/" className="text-lg font-bold tracking-tight text-black dark:text-white">
          AirDrop Web
        </Link>
        <UserButton afterSignOutUrl="/" />
      </header>

      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-black dark:text-white tracking-tight mb-8">
          Envoyer
        </h1>

        <div className="space-y-6">
          {/* File Selection with Drag & Drop - Swiss style */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <label
              className={`flex flex-col items-center justify-center w-full h-48 border-2 cursor-pointer transition-all ${
                isDragging
                  ? "border-black dark:border-white bg-gray-50 dark:bg-gray-900"
                  : "border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white"
              }`}
            >
              <div className="flex flex-col items-center justify-center py-6">
                <svg
                  className={`w-8 h-8 mb-4 transition-colors ${
                    isDragging ? "text-black dark:text-white" : "text-gray-400"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isDragging ? (
                    <span className="font-medium text-black dark:text-white">Déposez ici</span>
                  ) : (
                    <span>Glisser-déposer ou cliquer</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                  Max 50MB par fichier
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Selected Files List - Swiss style */}
          {selectedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-black dark:text-white">
                  {selectedFiles.length} fichier{selectedFiles.length > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setClearAllDialogOpen(true)}
                  className="text-sm text-gray-500 hover:text-black dark:hover:text-white underline transition-colors"
                >
                  Tout supprimer
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800">
                {selectedFiles.map((sf, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-black"
                  >
                    {sf.preview ? (
                      <img
                        src={sf.preview}
                        alt="Preview"
                        className="w-12 h-12 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-xl">
                        {getFileIcon(sf.file.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black dark:text-white truncate">
                        {sf.file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatFileSize(sf.file.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description Field - Swiss style */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel..."
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white placeholder-gray-400 focus:border-black dark:focus:border-white focus:outline-none resize-none"
              rows={2}
            />
          </div>

          {/* Compression toggle - Swiss style */}
          <div className="flex items-center justify-between py-4 border-t border-b border-gray-200 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-black dark:text-white">
                Compression auto
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Réduit la taille des images
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCompressImages(!compressImages)}
              className={`relative inline-flex h-6 w-11 items-center transition-colors ${
                compressImages ? "bg-black dark:bg-white" : "bg-gray-300 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform bg-white dark:bg-black transition-transform ${
                  compressImages ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Upload Button - Swiss style */}
          <button
            onClick={handleUpload}
            disabled={uploading || compressing || selectedFiles.length === 0}
            className="w-full py-4 px-6 bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            {compressing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Compression...
              </>
            ) : uploading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Envoi...
              </>
            ) : (
              <>
                Envoyer
                {selectedFiles.length > 0 && (
                  <span className="opacity-60">({selectedFiles.length})</span>
                )}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>

          {/* Messages - Swiss style */}
          {error && (
            <div className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-sm whitespace-pre-line">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 text-sm">
              {success}
            </div>
          )}
        </div>

        {/* Footer link - Swiss style */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            Voir mes fichiers
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </main>

      {/* Clear all confirmation dialog */}
      <ConfirmDialog
        isOpen={clearAllDialogOpen}
        title="Tout supprimer ?"
        message={`${selectedFiles.length} fichier(s) seront retirés de la liste.`}
        confirmText="Tout supprimer"
        cancelText="Annuler"
        confirmVariant="danger"
        onConfirm={clearAll}
        onCancel={() => setClearAllDialogOpen(false)}
      />
    </div>
  );
}
