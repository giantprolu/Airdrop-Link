interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const defaultOptions: CompressionOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.8,
  maxSizeMB: 5,
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...defaultOptions, ...options };

  // Only compress images
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Skip if already small enough
  const maxSizeBytes = (opts.maxSizeMB || 5) * 1024 * 1024;
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > (opts.maxWidth || 2048)) {
        height = (height * (opts.maxWidth || 2048)) / width;
        width = opts.maxWidth || 2048;
      }
      if (height > (opts.maxHeight || 2048)) {
        width = (width * (opts.maxHeight || 2048)) / height;
        height = opts.maxHeight || 2048;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        resolve(file);
        return;
      }

      // Draw and compress
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Create new file with original name
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          // If compressed file is larger, return original
          if (compressedFile.size >= file.size) {
            resolve(file);
            return;
          }

          resolve(compressedFile);
        },
        "image/jpeg",
        opts.quality || 0.8
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

export async function compressImages(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const compressed: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await compressImage(file, options);
      compressed.push(result);
    } catch {
      // If compression fails, use original
      compressed.push(file);
    }
    onProgress?.(i + 1, files.length);
  }

  return compressed;
}
