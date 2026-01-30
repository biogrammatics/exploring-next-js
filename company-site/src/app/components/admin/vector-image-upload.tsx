"use client";

import { useState, useRef } from "react";

interface VectorImageUploadProps {
  vectorId: string;
  currentThumbnail?: string | null;
  hasExistingImage?: boolean;
  onUploadComplete: (thumbnailBase64: string) => void;
  onRemove: () => void;
}

const FULL_IMAGE_SIZE = 1200; // High-res for detail page (uploaded to S3)
const THUMBNAIL_SIZE = 400; // Small preview for catalog (stored in DB)

export function VectorImageUpload({
  vectorId,
  currentThumbnail,
  hasExistingImage,
  onUploadComplete,
  onRemove,
}: VectorImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentThumbnail || null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Process image to create both versions
      const { fullImageBlob, thumbnailBase64 } = await processImage(file);

      // Upload full-size image to S3 via API
      const formData = new FormData();
      formData.append("file", fullImageBlob, "vector-map.png");
      formData.append("vectorId", vectorId);

      const response = await fetch("/api/admin/vectors/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload image");
      }

      // Update preview and notify parent
      setPreview(thumbnailBase64);
      onUploadComplete(thumbnailBase64);
    } catch (err) {
      console.error("Error processing image:", err);
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setProcessing(false);
    }
  }

  async function processImage(file: File): Promise<{
    fullImageBlob: Blob;
    thumbnailBase64: string;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          // Calculate crop to make square (center crop)
          const size = Math.min(img.width, img.height);
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;

          // Create full-size image (1200x1200 PNG)
          const fullCanvas = document.createElement("canvas");
          fullCanvas.width = FULL_IMAGE_SIZE;
          fullCanvas.height = FULL_IMAGE_SIZE;
          const fullCtx = fullCanvas.getContext("2d");

          if (!fullCtx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          fullCtx.imageSmoothingEnabled = true;
          fullCtx.imageSmoothingQuality = "high";
          fullCtx.fillStyle = "#ffffff";
          fullCtx.fillRect(0, 0, FULL_IMAGE_SIZE, FULL_IMAGE_SIZE);
          fullCtx.drawImage(
            img,
            offsetX,
            offsetY,
            size,
            size,
            0,
            0,
            FULL_IMAGE_SIZE,
            FULL_IMAGE_SIZE
          );

          // Create thumbnail (400x400 PNG)
          const thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = THUMBNAIL_SIZE;
          thumbCanvas.height = THUMBNAIL_SIZE;
          const thumbCtx = thumbCanvas.getContext("2d");

          if (!thumbCtx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          thumbCtx.imageSmoothingEnabled = true;
          thumbCtx.imageSmoothingQuality = "high";
          thumbCtx.fillStyle = "#ffffff";
          thumbCtx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
          thumbCtx.drawImage(
            img,
            offsetX,
            offsetY,
            size,
            size,
            0,
            0,
            THUMBNAIL_SIZE,
            THUMBNAIL_SIZE
          );

          // Convert full image to PNG blob
          fullCanvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to create image blob"));
                return;
              }

              // Get thumbnail as base64 PNG
              const thumbnailBase64 = thumbCanvas.toDataURL("image/png");

              resolve({
                fullImageBlob: blob,
                thumbnailBase64,
              });
            },
            "image/png",
            1.0
          );
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleRemove() {
    if (!confirm("Remove this image? This will delete both the thumbnail and the full-size image.")) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Call API to delete the image file from S3
      const response = await fetch(`/api/admin/vectors/image?vectorId=${vectorId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete image");
      }

      setPreview(null);
      onRemove();
    } catch (err) {
      console.error("Error removing image:", err);
      setError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setProcessing(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Vector Map Image
      </label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="Vector map preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-gray-400 text-sm p-2">
              <svg
                className="w-8 h-8 mx-auto mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              No image
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="vector-image-upload"
            disabled={processing}
          />
          <label
            htmlFor="vector-image-upload"
            className={`px-4 py-2 text-sm rounded-lg cursor-pointer text-center ${
              processing
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {processing ? "Processing..." : preview || hasExistingImage ? "Change" : "Upload"}
          </label>

          {(preview || hasExistingImage) && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={processing}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              Remove
            </button>
          )}

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <p className="text-xs text-gray-500 max-w-[180px]">
            Upload a square image. A high-res version (1200×1200) will be stored for detail pages,
            and a thumbnail (400×400) for the catalog.
          </p>
        </div>
      </div>
    </div>
  );
}
