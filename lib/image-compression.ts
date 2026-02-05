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

// Helper to create image source from file (with fallback for mobile)
async function createImageSource(file: File): Promise<string> {
  // Try FileReader first for better mobile compatibility
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error("FileReader result is not a string"));
        }
      };
      
      reader.onerror = () => {
        // Fallback to createObjectURL
        try {
          const url = URL.createObjectURL(file);
          resolve(url);
        } catch {
          reject(new Error("Failed to read file"));
        }
      };
      
      reader.readAsDataURL(file);
    } catch {
      // Final fallback
      try {
        const url = URL.createObjectURL(file);
        resolve(url);
      } catch {
        reject(new Error("Failed to create image source"));
      }
    }
  });
}

// Helper to sanitize filename for File constructor (mobile compatibility)
function sanitizeFilename(filename: string): string {
  // Remove or replace characters that can cause issues on mobile
  return filename
    .replace(/[^\w\s.-]/g, "_") // Replace special chars with underscore
    .replace(/\s+/g, "_") // Replace spaces with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
}

// Helper to create a File from Blob with mobile fallback
function createFileFromBlob(blob: Blob, filename: string): File {
  try {
    // Try File constructor first
    return new File([blob], filename, {
      type: blob.type || "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // File constructor not supported (older mobile browsers)
    // Create a Blob and add name property
    const blobWithName = blob as unknown as File;
    Object.defineProperty(blobWithName, 'name', {
      writable: true,
      value: filename
    });
    Object.defineProperty(blobWithName, 'lastModified', {
      writable: true,
      value: Date.now()
    });
    return blobWithName;
  }
}

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

  return new Promise(async (resolve) => {
    try {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        try {
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

              try {
                // Sanitize filename for mobile compatibility
                const safeName = sanitizeFilename(file.name) || "image.jpg";
                const compressedFile = createFileFromBlob(blob, safeName);

                // If compressed file is larger, return original
                if (compressedFile.size >= file.size) {
                  resolve(file);
                  return;
                }

                resolve(compressedFile);
              } catch {
                // File constructor failed, return original
                resolve(file);
              }
            },
            "image/jpeg",
            opts.quality || 0.8
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => {
        // Failed to load image, return original
        resolve(file);
      };

      // Use helper that handles mobile compatibility
      const src = await createImageSource(file);
      img.src = src;
    } catch {
      // Any error, return original file
      resolve(file);
    }
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
