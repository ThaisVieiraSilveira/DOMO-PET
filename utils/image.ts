/**
 * Utility to compress and resize images client-side before upload or storage.
 * This guarantees the image is lightweight, fast to upload/load, and stays
 * well within Firestore's 1MB document size limit when Base64 fallback is used.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.75
): Promise<{ file: File; base64: string }> {
  return new Promise((resolve, reject) => {
    // If the file is not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2d context from canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Get compressed Base64 (always JPEG to compress properly)
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        // Convert base64 back to File
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve({ file: compressedFile, base64: compressedBase64 });
            } else {
              reject(new Error('Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
