'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { convertFileToBase64 } from '../lib/utils';
import { loadStripe } from '@stripe/stripe-js';

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
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">ChatGPT Image Editor</h1>
        
        {/* Token Information */}
        <div className="bg-gray-100 p-4 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Your Tokens</h2>
              <p>Available: <span className="font-bold">{tokenCount}</span></p>
              <p className="text-sm text-gray-600">Each image edit costs 1 token</p>
            </div>
            <div className="flex space-x-2 items-center">
              <select 
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(Number(e.target.value))}
                className="border rounded p-2"
              >
                <option value={1}>1 Token</option>
                <option value={5}>5 Tokens</option>
                <option value={10}>10 Tokens</option>
                <option value={25}>25 Tokens</option>
              </select>
              <button
                onClick={handlePurchaseTokens}
                disabled={checkoutLoading}
                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
              >
                {checkoutLoading ? 'Processing...' : 'Purchase'}
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Upload Image</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif"
              onChange={handleImageChange}
              className="w-full p-2 border rounded"
            />
            <p className="text-xs text-gray-500 mt-1">Supported formats: PNG, JPG/JPEG, and GIF files under 4MB.</p>
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
            disabled={loading || tokenCount <= 0}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? 'Processing...' : tokenCount <= 0 ? 'Purchase Tokens to Continue' : description.trim() ? 'Edit Image' : 'Create Variation'}
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