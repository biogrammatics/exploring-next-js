"use client";

import { useState, useRef } from "react";

interface ThumbnailUploadProps {
  currentThumbnail?: string | null;
  onThumbnailChange: (base64: string | null) => void;
}

const THUMBNAIL_SIZE = 400;

export function ThumbnailUpload({
  currentThumbnail,
  onThumbnailChange,
}: ThumbnailUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentThumbnail || null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setProcessing(true);

    try {
      const base64 = await resizeAndConvertToWebP(file);
      setPreview(base64);
      onThumbnailChange(base64);
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Failed to process image");
    } finally {
      setProcessing(false);
    }
  }

  async function resizeAndConvertToWebP(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          // Create canvas for resizing
          const canvas = document.createElement("canvas");
          canvas.width = THUMBNAIL_SIZE;
          canvas.height = THUMBNAIL_SIZE;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Calculate crop to make square (center crop)
          const size = Math.min(img.width, img.height);
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;

          // Draw with white background (for transparency)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

          // Draw the image, cropping to square and resizing
          ctx.drawImage(
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

          // Convert to WebP (or PNG fallback)
          let base64 = canvas.toDataURL("image/webp", 0.85);

          // Fallback to PNG if WebP not supported
          if (!base64.startsWith("data:image/webp")) {
            base64 = canvas.toDataURL("image/png");
          }

          resolve(base64);
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  function handleRemove() {
    setPreview(null);
    onThumbnailChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Thumbnail Image
      </label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="Thumbnail preview"
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
            id="thumbnail-upload"
          />
          <label
            htmlFor="thumbnail-upload"
            className={`px-4 py-2 text-sm rounded-lg cursor-pointer text-center ${
              processing
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {processing ? "Processing..." : preview ? "Change" : "Upload"}
          </label>

          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              Remove
            </button>
          )}

          <p className="text-xs text-gray-500 max-w-[150px]">
            Image will be cropped to 400×400px square and converted to WebP
          </p>
        </div>
      </div>
    </div>
  );
}
