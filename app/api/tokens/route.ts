import { NextResponse } from 'next/server';
import { getOrCreateSession, getTokenCount, addTokens } from '../../../lib/tokenService';

export async function GET(request: Request) {
  try {
    // Extract session ID from query parameters
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    console.log('[DEBUG API] GET tokens with sessionId:', sessionId);

    if (sessionId) {
      // Get token count for the existing session
      const tokenCount = getTokenCount(sessionId);
      console.log('[DEBUG API] Retrieved token count:', tokenCount);
      return NextResponse.json({ sessionId, tokenCount });
    } else {
      // Create a new session if no sessionId is provided
      console.log('[DEBUG API] No sessionId provided, creating new session');
      const newSession = getOrCreateSession();
      console.log('[DEBUG API] Created new session:', newSession.id);
      return NextResponse.json({ 
        sessionId: newSession.id, 
        tokenCount: newSession.tokens 
      });
    }
  } catch (error) {
    console.error('[DEBUG API] Error getting token count:', error);
    return NextResponse.json(
      { error: 'Failed to get token count' },
      { status: 500 }
    );
  }
}

// In a production app, this would be properly secured
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[DEBUG API] POST tokens with body:', body);
    const { sessionId, action, amount } = body;
    
    if (!sessionId) {
      console.error('[DEBUG API] Missing sessionId in request');
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (action === 'add' && amount > 0) {
      console.log('[DEBUG API] Adding tokens:', amount, 'to session:', sessionId);
      const session = addTokens(sessionId, amount);
      console.log('[DEBUG API] Updated session:', session);
      return NextResponse.json({ 
        sessionId: session.id, 
        tokenCount: session.tokens 
      });
    }
    
    console.error('[DEBUG API] Invalid action or amount:', action, amount);
    return NextResponse.json(
      { error: 'Invalid action or amount' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DEBUG API] Error updating tokens:', error);
    return NextResponse.json(
      { error: 'Failed to update tokens' },
      { status: 500 }
    );
  }
} 