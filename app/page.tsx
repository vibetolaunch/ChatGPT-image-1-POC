'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { convertFileToBase64 } from '../lib/utils';

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Generate preview when image changes
  useEffect(() => {
    const generatePreview = async () => {
      if (image) {
        try {
          const base64 = await convertFileToBase64(image);
          setPreviewImage(base64);
        } catch (err) {
          console.error('Error generating preview:', err);
          setError('Failed to generate image preview');
        }
      } else {
        setPreviewImage(null);
      }
    };

    generatePreview();
  }, [image]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setImage(file);
      setEditedImage(null); // Clear previous edited image when new image is selected
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Please provide an image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      const imageData = await image.arrayBuffer();
      const correctedName = image.name.endsWith('.png') ? image.name : image.name.replace(/\.[^/.]+$/, "") + ".png";
      const imageFile = new File([imageData], correctedName, { type: 'image/png' });
      formData.append('image', imageFile);
      formData.append('description', description);

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit image');
      }

      const data = await response.json();
      // Convert the base64 string to a data URL
      const base64ImageData = data.editedImageB64;
      if (base64ImageData) {
        setEditedImage(`data:image/png;base64,${base64ImageData}`);
      } else {
        throw new Error('No image data received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">ChatGPT Image Editor</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Upload Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 border rounded"
            />
<p className="text-xs text-gray-500 mt-1">Only PNG files under 4MB are supported.</p>
          </div>

          {previewImage && (
            <div className="mt-4">
              <h2 className="text-lg font-medium mb-2">Image Preview</h2>
              <div className="relative w-full h-64 border rounded overflow-hidden">
                <Image
                  src={previewImage}
                  alt="Upload preview"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Edit Description (optional for variations)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded h-32"
              placeholder="Describe how you want to edit the image, or leave empty for variations"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? 'Processing...' : description.trim() ? 'Edit Image' : 'Create Variation'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {editedImage && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Edited Image</h2>
            <div className="relative w-full h-96">
              <Image
                src={editedImage}
                alt="Edited result"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 