"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import ConfirmDialog from "@/components/ConfirmDialog";

interface FileItem {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  description: string | null;
  is_favorite: boolean;
  tags: string[];
  share_token: string | null;
  created_at: string;
  url: string | null;
}

type SortOption = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "size_desc" | "size_asc" | "favorites";

export default function GalleryPage() {
  const { user } = useUser();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(12);

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Fullscreen viewer
  const [fullscreenFile, setFullscreenFile] = useState<FileItem | null>(null);

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileItem | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Tag editing
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [fileToTag, setFileToTag] = useState<FileItem | null>(null);
  const [tagInput, setTagInput] = useState("");

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch("/api/files");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch files");
      }

      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("files-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "files",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchFiles();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "files",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setFiles((prev) => prev.filter((f) => f.id !== payload.old.id));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(payload.old.id);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchFiles]);

  // Filtered and sorted files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search filter (now includes tags)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.file_name.toLowerCase().includes(query) ||
          (f.description && f.description.toLowerCase().includes(query)) ||
          (f.tags && f.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc":
          return a.file_name.localeCompare(b.file_name);
        case "name_desc":
          return b.file_name.localeCompare(a.file_name);
        case "size_desc":
          return (b.file_size || 0) - (a.file_size || 0);
        case "size_asc":
          return (a.file_size || 0) - (b.file_size || 0);
        case "favorites":
          return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchQuery, sortBy]);

  // Paginated files for display
  const paginatedFiles = useMemo(() => {
    return filteredFiles.slice(0, visibleCount);
  }, [filteredFiles, visibleCount]);

  const hasMore = visibleCount < filteredFiles.length;

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + 12);
  }, []);

  // Reset pagination when search/sort changes
  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, sortBy]);

  const handleDownload = async (file: FileItem) => {
    if (!file.url) return;

    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name || "download";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleBulkDownload = async () => {
    const filesToDownload = files.filter((f) => selectedIds.has(f.id));
    for (const file of filesToDownload) {
      await handleDownload(file);
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const openDeleteDialog = (file: FileItem) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      const response = await fetch(`/api/files?id=${fileToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      closeDeleteDialog();
    }
  };

  const confirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);

    for (const id of idsToDelete) {
      try {
        await fetch(`/api/files?id=${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }

    setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteDialogOpen(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFavorite = async (file: FileItem) => {
    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, is_favorite: !file.is_favorite }),
      });

      if (response.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, is_favorite: !f.is_favorite } : f
          )
        );
      }
    } catch (err) {
      console.error("Toggle favorite failed:", err);
    }
  };

  const openShareDialog = async (file: FileItem) => {
    setFileToShare(file);
    if (file.share_token) {
      setShareLink(`${window.location.origin}/share/${file.share_token}`);
    } else {
      setShareLink(null);
    }
    setShareDialogOpen(true);
    setCopySuccess(false);
  };

  const generateShareLink = async () => {
    if (!fileToShare) return;

    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileToShare.id, generate_share_link: true }),
      });

      const data = await response.json();
      if (response.ok && data.file.share_token) {
        const link = `${window.location.origin}/share/${data.file.share_token}`;
        setShareLink(link);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileToShare.id ? { ...f, share_token: data.file.share_token } : f
          )
        );
      }
    } catch (err) {
      console.error("Generate share link failed:", err);
    }
  };

  const removeShareLink = async () => {
    if (!fileToShare) return;

    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileToShare.id, remove_share_link: true }),
      });

      if (response.ok) {
        setShareLink(null);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileToShare.id ? { ...f, share_token: null } : f
          )
        );
      }
    } catch (err) {
      console.error("Remove share link failed:", err);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const openTagDialog = (file: FileItem) => {
    setFileToTag(file);
    setTagInput(file.tags?.join(", ") || "");
    setTagDialogOpen(true);
  };

  const saveTags = async () => {
    if (!fileToTag) return;

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileToTag.id, tags }),
      });

      if (response.ok) {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileToTag.id ? { ...f, tags } : f))
        );
        setTagDialogOpen(false);
        setFileToTag(null);
        setTagInput("");
      }
    } catch (err) {
      console.error("Save tags failed:", err);
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
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

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (!type) return "📎";
    if (type.startsWith("image/")) return "🖼️";
    if (type.startsWith("video/")) return "🎬";
    if (type.startsWith("audio/")) return "🎵";
    if (type.includes("pdf")) return "📄";
    if (type.includes("zip") || type.includes("rar")) return "📦";
    if (type.includes("word") || type.includes("document")) return "📝";
    if (type.includes("sheet") || type.includes("excel")) return "📊";
    return "📎";
  };

  const isImage = (type: string) => type?.startsWith("image/");

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Minimal header - Swiss style */}
      <header className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 bg-white dark:bg-black">
        <Link href="/" className="text-lg font-bold tracking-tight text-black dark:text-white">
          AirDrop Web
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/upload"
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Envoyer
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header - Swiss style */}
        <div className="flex items-end justify-between mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white tracking-tight">
            Fichiers
          </h1>
          <span className="text-sm text-gray-500 font-mono">
            {filteredFiles.length}/{files.length}
          </span>
        </div>

        {/* Search and Sort Bar - Swiss style */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Rechercher par nom, description ou tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white placeholder-gray-400 focus:border-black dark:focus:border-white focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-3 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white focus:border-black dark:focus:border-white focus:outline-none"
          >
            <option value="date_desc">Récent</option>
            <option value="date_asc">Ancien</option>
            <option value="name_asc">A-Z</option>
            <option value="name_desc">Z-A</option>
            <option value="size_desc">Taille ↓</option>
            <option value="size_asc">Taille ↑</option>
            <option value="favorites">Favoris</option>
          </select>

          {/* Selection mode toggle */}
          <button
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedIds(new Set());
            }}
            className={`px-4 py-3 font-medium transition-colors ${
              selectionMode
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white"
            }`}
          >
            {selectionMode ? "Annuler" : "Sélectionner"}
          </button>
        </div>

        {/* Selection actions bar - Swiss style */}
        {selectionMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-4 mb-6 py-4 border-t border-b border-gray-200 dark:border-gray-800">
            <span className="text-sm font-medium text-black dark:text-white">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-gray-500 hover:text-black dark:hover:text-white underline"
            >
              Tout
            </button>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-500 hover:text-black dark:hover:text-white underline"
            >
              Aucun
            </button>
            <div className="flex-1" />
            <button
              onClick={handleBulkDownload}
              className="px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Télécharger
            </button>
            <button
              onClick={() => setBulkDeleteDialogOpen(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Supprimer
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <svg className="animate-spin h-6 w-6 text-black dark:text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 dark:text-gray-600 mb-6">
              {searchQuery ? "Aucun résultat" : "Aucun fichier"}
            </p>
            {!searchQuery && (
              <Link
                href="/upload"
                className="inline-block px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Envoyer un fichier
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedFiles.map((file) => (
              <div
                key={file.id}
                className={`bg-white dark:bg-black overflow-hidden border transition-all ${
                  selectedIds.has(file.id)
                    ? "border-black dark:border-white"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                {/* Preview - clickable for fullscreen */}
                <div
                  className="relative cursor-pointer group"
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelection(file.id);
                    } else if (isImage(file.file_type) && file.url) {
                      setFullscreenFile(file);
                    }
                  }}
                >
                  {selectionMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <div
                        className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(file.id)
                            ? "bg-black dark:bg-white border-black dark:border-white"
                            : "bg-white/90 dark:bg-black/90 border-gray-400 dark:border-gray-600"
                        }`}
                      >
                        {selectedIds.has(file.id) && (
                          <svg className="w-3 h-3 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}

                  {isImage(file.file_type) && file.url ? (
                    <>
                      <img
                        src={file.url}
                        alt={file.file_name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-48 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center border-b border-gray-200 dark:border-gray-800">
                      <span className="text-4xl mb-2">{getFileIcon(file.file_type)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-500 font-mono px-4 truncate max-w-full uppercase tracking-wide">
                        {file.file_type?.split("/").pop() || "fichier"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-black dark:text-white truncate flex-1 text-sm" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(file);
                      }}
                      className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 ${file.is_favorite ? "text-black dark:text-white fill-black dark:fill-white" : "text-gray-400"}`}
                        fill={file.is_favorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>

                  {file.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {file.description}
                    </p>
                  )}

                  {/* Tags - Swiss style */}
                  {file.tags && file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {file.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mb-3 font-mono">
                    <span>{formatDate(file.created_at)}</span>
                    {file.file_size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(file.file_size)}</span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-gray-200 dark:border-gray-800 pt-3 mt-3">
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={!file.url}
                      className="flex-1 py-2 px-3 bg-black dark:bg-white text-white dark:text-black text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Télécharger
                    </button>
                    <button
                      onClick={() => openShareDialog(file)}
                      className={`py-2 px-3 text-xs font-medium transition-colors border ${
                        file.share_token
                          ? "border-black dark:border-white text-black dark:text-white"
                          : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openTagDialog(file)}
                      className="py-2 px-3 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openDeleteDialog(file)}
                      className="py-2 px-3 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-500 text-xs font-medium hover:border-red-500 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load more button */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                className="px-8 py-3 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-medium hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
              >
                Charger plus ({filteredFiles.length - visibleCount} restants)
              </button>
            </div>
          )}
          </>
        )}

        {/* Realtime indicator - Swiss style */}
        <div className="fixed bottom-4 right-4 px-3 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-white dark:bg-black animate-pulse" />
          Sync
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Supprimer ce fichier ?"
        message={fileToDelete ? `"${fileToDelete.file_name}" sera définitivement supprimé.` : ""}
        confirmText="Supprimer"
        cancelText="Annuler"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />

      {/* Bulk delete confirmation dialog */}
      <ConfirmDialog
        isOpen={bulkDeleteDialogOpen}
        title="Supprimer les fichiers sélectionnés ?"
        message={`${selectedIds.size} fichier(s) seront définitivement supprimés.`}
        confirmText="Supprimer tout"
        cancelText="Annuler"
        confirmVariant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />

      {/* Fullscreen image viewer */}
      {fullscreenFile && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreenFile(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={() => setFullscreenFile(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <button
            className="absolute bottom-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(fullscreenFile);
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Télécharger
          </button>

          <div className="absolute bottom-4 left-4 text-white/80 text-sm">
            {fullscreenFile.file_name}
          </div>

          <img
            src={fullscreenFile.url || ""}
            alt={fullscreenFile.file_name}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Share dialog - Swiss style */}
      {shareDialogOpen && fileToShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShareDialogOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-black border border-gray-200 dark:border-gray-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-lg font-bold text-black dark:text-white mb-1 tracking-tight">
                Partager
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-6 truncate font-mono">
                {fileToShare.file_name}
              </p>

              {shareLink ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-black dark:text-white font-mono"
                    />
                    <button
                      onClick={copyShareLink}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        copySuccess
                          ? "bg-black dark:bg-white text-white dark:text-black"
                          : "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100"
                      }`}
                    >
                      {copySuccess ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <button
                    onClick={removeShareLink}
                    className="w-full py-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
                  >
                    Désactiver le partage
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateShareLink}
                  className="w-full py-3 px-4 bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  Générer un lien
                </button>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setShareDialogOpen(false)}
                className="w-full py-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag dialog - Swiss style */}
      {tagDialogOpen && fileToTag && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setTagDialogOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-black border border-gray-200 dark:border-gray-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-lg font-bold text-black dark:text-white mb-1 tracking-tight">
                Tags
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-6 truncate font-mono">
                {fileToTag.file_name}
              </p>

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tag1, tag2, tag3..."
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white placeholder-gray-400 focus:border-black dark:focus:border-white focus:outline-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Séparez les tags par des virgules
              </p>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setTagDialogOpen(false)}
                className="flex-1 py-2 px-4 text-sm font-medium text-gray-500 border border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveTags}
                className="flex-1 py-2 px-4 text-sm font-medium text-white dark:text-black bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
