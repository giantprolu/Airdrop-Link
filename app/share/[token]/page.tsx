"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface SharedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  description: string | null;
  created_at: string;
  url: string | null;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFile() {
      try {
        const response = await fetch(`/api/share?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Fichier introuvable");
        }

        setFile(data.file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchFile();
    }
  }, [token]);

  const handleDownload = async () => {
    if (!file?.url) return;

    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isImage = (type: string) => type?.startsWith("image/");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Fichier introuvable
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Ce lien de partage n&apos;existe pas ou a expiré.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <header className="flex items-center justify-between p-4 border-b bg-white/80 backdrop-blur dark:bg-gray-900/80">
        <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
          AirDrop Web
        </Link>
        <Link
          href="/sign-in"
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
        >
          Se connecter
        </Link>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
          {/* Preview */}
          {file && isImage(file.file_type) && file.url ? (
            <img
              src={file.url}
              alt={file.file_name}
              className="w-full max-h-[60vh] object-contain bg-gray-100 dark:bg-gray-700"
            />
          ) : (
            <div className="h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-6xl">
                {file?.file_type?.startsWith("video/") ? "🎬" :
                 file?.file_type?.startsWith("audio/") ? "🎵" :
                 file?.file_type?.includes("pdf") ? "📄" : "📎"}
              </span>
            </div>
          )}

          {/* File info */}
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2 break-all">
              {file?.file_name}
            </h1>

            {file?.description && (
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {file.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-6">
              {file?.file_size && <span>{formatFileSize(file.file_size)}</span>}
              {file?.created_at && (
                <>
                  <span>•</span>
                  <span>{formatDate(file.created_at)}</span>
                </>
              )}
            </div>

            <button
              onClick={handleDownload}
              disabled={!file?.url}
              className="w-full py-3 px-4 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Télécharger
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Partagé via{" "}
          <Link href="/" className="text-blue-500 hover:underline">
            AirDrop Web
          </Link>
        </p>
      </main>
    </div>
  );
}
