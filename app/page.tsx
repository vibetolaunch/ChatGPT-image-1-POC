'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { convertFileToBase64 } from '../lib/utils';
import { loadStripe } from '@stripe/stripe-js';
import { featureFlags } from '../lib/config';
import UserImages from './components/UserImages';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '');

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [purchaseAmount, setPurchaseAmount] = useState<number>(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // On initial load, get or create a session
  useEffect(() => {
    const savedSessionId = localStorage.getItem('imageEditorSessionId');
    console.log('[DEBUG] Saved session ID from localStorage:', savedSessionId);
    
    if (savedSessionId) {
      console.log('[DEBUG] Using saved session ID:', savedSessionId);
      setSessionId(savedSessionId);
      
      // First check localStorage for tokens (for immediate display)
      try {
        const storedSessions = localStorage.getItem('imageEditorSessions');
        console.log('[DEBUG] Retrieved from localStorage:', storedSessions);
        
        if (storedSessions) {
          const sessionsArray = JSON.parse(storedSessions);
          console.log('[DEBUG] Parsed sessions:', sessionsArray);
          
          const userSession = sessionsArray.find((session: any) => session.id === savedSessionId);
          console.log('[DEBUG] Found user session?', !!userSession, userSession);
          
          if (userSession && userSession.tokens !== undefined) {
            console.log('[DEBUG] Found token count in localStorage:', userSession.tokens);
            setTokenCount(userSession.tokens);
            
            // Sync with server to ensure consistency
            syncTokensWithServer(savedSessionId, sessionsArray);
          } else {
            console.log('[DEBUG] No matching session found in localStorage or tokens undefined');
            // Still fetch from server since we have a sessionId
            fetchTokenCount(savedSessionId);
          }
        } else {
          console.log('[DEBUG] No sessions found in localStorage');
          // Still fetch from server since we have a sessionId
          fetchTokenCount(savedSessionId);
        }
      } catch (err) {
        console.error('[DEBUG] Error reading sessions from localStorage:', err);
        // Fallback to server
        fetchTokenCount(savedSessionId);
      }
    } else {
      console.log('No saved session ID found, creating a new one');
      // Create a new session
      fetch('/api/tokens')
        .then(response => response.json())
        .then(data => {
          console.log('API response for new session:', data);
          if (data.sessionId) {
            console.log('Setting new session ID:', data.sessionId);
            setSessionId(data.sessionId);
            localStorage.setItem('imageEditorSessionId', data.sessionId);
            setTokenCount(data.tokenCount || 0);
          } else {
            console.error('No session ID returned from API');
          }
        })
        .catch(err => {
          console.error('Error creating session:', err);
          setError('Failed to initialize session');
        });
    }
  }, []);

  // Add a useEffect to refresh token count 1 second after component mounts
  // This helps after redirects from payment success page
  useEffect(() => {
    // Only run if we have a sessionId
    if (sessionId) {
      // Wait a second to ensure any localStorage updates from other pages have settled
      const timer = setTimeout(() => {
        console.log('[DEBUG] Running delayed token refresh for session:', sessionId);
        
        // Check localStorage first
        try {
          const storedSessions = localStorage.getItem('imageEditorSessions');
          if (storedSessions) {
            const sessionsArray = JSON.parse(storedSessions);
            const userSession = sessionsArray.find((session: any) => session.id === sessionId);
            
            if (userSession && userSession.tokens !== undefined) {
              console.log('[DEBUG] Delayed refresh found tokens in localStorage:', userSession.tokens);
              setTokenCount(userSession.tokens);
            }
          }
        } catch (err) {
          console.error('[DEBUG] Error in delayed localStorage check:', err);
        }
        
        // Also get from server
        fetchTokenCount(sessionId);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  // Sync tokens between client and server
  const syncTokensWithServer = async (sessionId: string, clientSessions: any[]) => {
    console.log('[DEBUG] Syncing tokens with server for session:', sessionId);
    try {
      const response = await fetch('/api/sync-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSessions,
          currentSessionId: sessionId
        }),
      });
      
      if (!response.ok) {
        console.error('[DEBUG] Token sync response not OK:', response.status);
        // Fallback to regular token fetch
        fetchTokenCount(sessionId);
        return;
      }
      
      const data = await response.json();
      console.log('[DEBUG] Token sync response:', data);
      
      if (data.tokenCount !== undefined) {
        setTokenCount(data.tokenCount);
        console.log('[DEBUG] Updated token count from sync:', data.tokenCount);
      }
    } catch (err) {
      console.error('[DEBUG] Error syncing tokens:', err);
      // Fallback to regular token fetch
      fetchTokenCount(sessionId);
    }
  };

  // Fetch token count
  const fetchTokenCount = (sid: string) => {
    console.log('[DEBUG] Fetching token count for session:', sid);
    fetch(`/api/tokens?sessionId=${sid}`)
      .then(response => {
        console.log('[DEBUG] Token fetch response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('[DEBUG] Token fetch response data:', data);
        setTokenCount(data.tokenCount || 0);
      })
      .catch(err => {
        console.error('[DEBUG] Error fetching token count:', err);
      });
  };

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

  // Log sessionId on each render
  useEffect(() => {
    console.log('Current sessionId:', sessionId);
  }, [sessionId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      
      // Check if the image is in a supported format
      if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif'].includes(file.type)) {
        setError('Only PNG, JPG/JPEG, and GIF formats are supported');
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

    if (!sessionId) {
      setError('Session not initialized. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      const imageData = await image.arrayBuffer();
      // Use the original file with its native format
      const imageFile = new File([imageData], image.name, { type: image.type });
      formData.append('image', imageFile);
      formData.append('description', description);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402 && data.needTokens) {
          setError('You need to purchase tokens to use this feature.');
          return;
        }
        throw new Error(data.error || 'Failed to edit image');
      }

      // Convert the base64 string to a data URL
      const base64ImageData = data.editedImageB64;
      if (base64ImageData) {
        setEditedImage(`data:image/png;base64,${base64ImageData}`);
        // Refresh token count after successful operation
        fetchTokenCount(sessionId);
      } else {
        throw new Error('No image data received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseTokens = async () => {
    if (!sessionId) {
      setError('Session not initialized. Please refresh the page.');
      return;
    }

    console.log('Attempting purchase with sessionId:', sessionId);
    setCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenCount: purchaseAmount,
          sessionId
        }),
      });

      console.log('Request sent with body:', JSON.stringify({
        tokenCount: purchaseAmount,
        sessionId
      }));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout process');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Token Purchase Section */}
        <div className="bg-white shadow sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Available Tokens: {tokenCount}
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Purchase tokens to edit your images.</p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={handlePurchaseTokens}
                disabled={checkoutLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {checkoutLoading ? 'Processing...' : 'Purchase Tokens'}
              </button>
            </div>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="bg-white shadow sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Upload and Edit Image
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Image
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    {previewImage ? (
                      <div className="relative h-48 w-full">
                        <Image
                          src={previewImage}
                          alt="Preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <div className="mt-1">
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe how you want to edit the image..."
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!image || !description || loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Edit Image'}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {editedImage && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Edited Image:
                </h4>
                <div className="relative h-64 w-full">
                  <Image
                    src={editedImage}
                    alt="Edited"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User's Images Section */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Your Images
            </h3>
            <UserImages />
          </div>
        </div>
      </div>
    </main>
  );
} 