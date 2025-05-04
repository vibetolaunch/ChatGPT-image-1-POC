import { NextResponse } from 'next/server';
import { getOrCreateSession, getTokenCount, addTokens } from '../../../lib/tokenService';

export async function GET(request: Request) {
  try {
    // Extract session ID from query parameters
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId) {
      // Get token count for the existing session
      const tokenCount = getTokenCount(sessionId);
      return NextResponse.json({ sessionId, tokenCount });
    } else {
      // Create a new session if no sessionId is provided
      const newSession = getOrCreateSession();
      return NextResponse.json({ 
        sessionId: newSession.id, 
        tokenCount: newSession.tokens 
      });
    }
  } catch (error) {
    console.error('Error getting token count:', error);
    return NextResponse.json(
      { error: 'Failed to get token count' },
      { status: 500 }
    );
  }
}

// In a production app, this would be properly secured
export async function POST(request: Request) {
  try {
    const { sessionId, action, amount } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (action === 'add' && amount > 0) {
      const session = addTokens(sessionId, amount);
      return NextResponse.json({ 
        sessionId: session.id, 
        tokenCount: session.tokens 
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action or amount' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating tokens:', error);
    return NextResponse.json(
      { error: 'Failed to update tokens' },
      { status: 500 }
    );
  }
} 