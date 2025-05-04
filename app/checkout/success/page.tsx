'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const userSession = searchParams.get('user_session');
    const tokenCount = searchParams.get('tokens');

    if (!sessionId || !userSession || !tokenCount) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    // For demo purposes, we'll update the tokens directly from the client
    // In production, this should be handled through the Stripe webhook
    fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: userSession,
        action: 'add',
        amount: parseInt(tokenCount, 10),
      }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update tokens');
        }
        return response.json();
      })
      .then(data => {
        setSuccess(true);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error updating tokens:', err);
        setError('Failed to update your token balance');
        setLoading(false);
      });
  }, [searchParams]);

  // Redirect to homepage after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        {loading ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Processing Your Payment</h1>
            <p className="text-gray-600 mb-4">Please wait while we confirm your purchase...</p>
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : error ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/" className="text-blue-500 hover:underline">
              Return to home
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-green-600">Payment Successful!</h1>
            <p className="text-gray-600 mb-4">
              Your tokens have been added to your account. You will be redirected to the home page in a few seconds.
            </p>
            <Link href="/" className="text-blue-500 hover:underline">
              Return to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 