import { NextResponse } from 'next/server';
import { getOrCreateSession, addTokens } from '../../../lib/tokenService';

export async function POST(request: Request) {
  try {
    // Parse the client-side sessions data
    const { clientSessions, currentSessionId } = await request.json();
    console.log('[DEBUG SYNC] Received sync request with sessions:', clientSessions, 'currentSessionId:', currentSessionId);
    
    if (!currentSessionId) {
      console.error('[DEBUG SYNC] Missing currentSessionId');
      return NextResponse.json(
        { error: 'Current session ID is required' },
        { status: 400 }
      );
    }

    // Ensure the current session exists on the server
    const serverSession = getOrCreateSession(currentSessionId);
    console.log('[DEBUG SYNC] Server session:', serverSession);

    // If the client has token data for this session, use it to update the server
    if (clientSessions && Array.isArray(clientSessions)) {
      const clientSession = clientSessions.find(s => s.id === currentSessionId);
      console.log('[DEBUG SYNC] Found client session:', clientSession);
      
      if (clientSession && typeof clientSession.tokens === 'number' && clientSession.tokens > 0) {
        // If client has tokens but server doesn't, force an update
        if (clientSession.tokens > serverSession.tokens) {
          console.log('[DEBUG SYNC] Client has more tokens than server, updating server');
          // Set the server tokens to match the client
          const tokensToAdd = clientSession.tokens - serverSession.tokens;
          if (tokensToAdd > 0) {
            const updatedSession = addTokens(currentSessionId, tokensToAdd);
            console.log('[DEBUG SYNC] Added tokens to server:', tokensToAdd, 'new total:', updatedSession.tokens);
            return NextResponse.json({ 
              synced: true, 
              sessionId: updatedSession.id,
              tokenCount: updatedSession.tokens
            });
          }
        }
      }
    }

    // If no update was needed, just return the current server state
    return NextResponse.json({ 
      synced: false,
      sessionId: serverSession.id,
      tokenCount: serverSession.tokens
    });
  } catch (error) {
    console.error('[DEBUG SYNC] Error syncing tokens:', error);
    return NextResponse.json(
      { error: 'Failed to sync tokens' },
      { status: 500 }
    );
  }
} 