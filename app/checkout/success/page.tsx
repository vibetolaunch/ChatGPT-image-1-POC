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
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const userSession = searchParams.get('user_session');
    const tokenCount = searchParams.get('tokens');

    console.log('[DEBUG] Success page params:', { sessionId, userSession, tokenCount });
    
    let debugLog = `Params: sessionId=${sessionId}, userSession=${userSession}, tokenCount=${tokenCount}\n`;

    if (!sessionId || !userSession || !tokenCount) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    // Check localStorage before update
    try {
      const beforeSessions = localStorage.getItem('imageEditorSessions');
      debugLog += `Before localStorage: ${beforeSessions}\n`;
      console.log('[DEBUG] Before localStorage update:', beforeSessions);
    } catch (err) {
      console.error('Error checking localStorage:', err);
    }

    // Make sure the session ID is saved in localStorage
    localStorage.setItem('imageEditorSessionId', userSession);
    
    // Ensure the session exists in localStorage first
    try {
      const tokenAmount = parseInt(tokenCount, 10);
      let sessionsArray = [];
      const storedSessions = localStorage.getItem('imageEditorSessions');
      
      if (storedSessions) {
        sessionsArray = JSON.parse(storedSessions);
      }
      
      // Check if session exists
      const sessionExists = sessionsArray.some((s: any) => s.id === userSession);
      if (!sessionExists) {
        // Add the session to localStorage
        sessionsArray.push({
          id: userSession,
          tokens: tokenAmount,
          createdAt: Date.now()
        });
        localStorage.setItem('imageEditorSessions', JSON.stringify(sessionsArray));
        debugLog += `Added session to localStorage with tokens: ${tokenAmount}\n`;
      } else {
        // Update the existing session
        const updatedSessions = sessionsArray.map((session: any) => {
          if (session.id === userSession) {
            const newTokens = (session.tokens || 0) + tokenAmount;
            debugLog += `Updated session in localStorage from ${session.tokens} to ${newTokens} tokens\n`;
            return { ...session, tokens: newTokens };
          }
          return session;
        });
        localStorage.setItem('imageEditorSessions', JSON.stringify(updatedSessions));
      }
    } catch (err) {
      console.error('[DEBUG] Error setting up localStorage:', err);
      debugLog += `Error setting up localStorage: ${err}\n`;
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
        console.log('[DEBUG] API response status:', response.status);
        debugLog += `API response status: ${response.status}\n`;
        if (!response.ok) {
          throw new Error('Failed to update tokens');
        }
        return response.json();
      })
      .then(data => {
        console.log('[DEBUG] API response data:', data);
        debugLog += `API response data: ${JSON.stringify(data)}\n`;
        
        // Also update localStorage directly as a fallback mechanism
        try {
          const tokenAmount = parseInt(tokenCount, 10);
          const storedSessions = localStorage.getItem('imageEditorSessions');
          console.log('[DEBUG] Current localStorage before direct update:', storedSessions);
          debugLog += `Current localStorage: ${storedSessions}\n`;
          
          if (storedSessions) {
            const sessionsArray = JSON.parse(storedSessions);
            console.log('[DEBUG] Parsed sessions:', sessionsArray);
            
            // Check if the session exists
            const sessionExists = sessionsArray.some((s: any) => s.id === userSession);
            console.log('[DEBUG] Session exists in localStorage?', sessionExists);
            debugLog += `Session exists in localStorage? ${sessionExists}\n`;
            
            if (!sessionExists) {
              // If session doesn't exist in localStorage, create it
              sessionsArray.push({
                id: userSession,
                tokens: tokenAmount,
                createdAt: Date.now()
              });
              console.log('[DEBUG] Added new session to localStorage');
              debugLog += `Added new session to localStorage\n`;
            } else {
              // Update existing session
              const updatedSessions = sessionsArray.map((session: any) => {
                if (session.id === userSession) {
                  const newTokenCount = (session.tokens || 0) + tokenAmount;
                  console.log('[DEBUG] Updating session tokens from', session.tokens, 'to', newTokenCount);
                  debugLog += `Updating session tokens from ${session.tokens} to ${newTokenCount}\n`;
                  return { ...session, tokens: newTokenCount };
                }
                return session;
              });
              sessionsArray.splice(0, sessionsArray.length, ...updatedSessions);
            }
            
            localStorage.setItem('imageEditorSessions', JSON.stringify(sessionsArray));
            
            // Log the updated localStorage
            console.log('[DEBUG] Updated localStorage:', localStorage.getItem('imageEditorSessions'));
            debugLog += `Updated localStorage: ${localStorage.getItem('imageEditorSessions')}\n`;
          } else {
            // If no sessions exist yet, create a new array with this session
            const newSessions = [{
              id: userSession,
              tokens: tokenAmount,
              createdAt: Date.now()
            }];
            localStorage.setItem('imageEditorSessions', JSON.stringify(newSessions));
            console.log('[DEBUG] Created new sessions in localStorage:', newSessions);
            debugLog += `Created new sessions in localStorage: ${JSON.stringify(newSessions)}\n`;
          }
        } catch (err) {
          console.error('[DEBUG] Error updating localStorage:', err);
          debugLog += `Error updating localStorage: ${err}\n`;
        }
        
        setDebugInfo(debugLog);
        setSuccess(true);
        setLoading(false);
      })
      .catch(err => {
        console.error('[DEBUG] Error updating tokens:', err);
        debugLog += `Error updating tokens: ${err}\n`;
        setDebugInfo(debugLog);
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
            <pre className="text-xs text-left bg-gray-100 p-2 mt-4 rounded overflow-auto max-h-40">{debugInfo}</pre>
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
            <p className="text-gray-600 mb-4">
              If you don't see your token count updated, please refresh the page after redirection.
            </p>
            <pre className="text-xs text-left bg-gray-100 p-2 mt-4 rounded overflow-auto max-h-40">{debugInfo}</pre>
            <Link href="/" className="text-blue-500 hover:underline">
              Return to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 