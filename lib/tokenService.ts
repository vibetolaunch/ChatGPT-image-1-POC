import { v4 as uuidv4 } from 'uuid';

// Interface for session data
interface SessionData {
  id: string;
  tokens: number;
  createdAt: number;
}

// In-memory storage for sessions (would use a database in production)
const sessions = new Map<string, SessionData>();

// Session expiration time (24 hours in milliseconds)
const SESSION_EXPIRATION = 24 * 60 * 60 * 1000;

// Initialize sessions from localStorage if running in browser
if (typeof window !== 'undefined') {
  try {
    console.log('[DEBUG] Initializing tokenService, checking localStorage');
    const storedSessions = localStorage.getItem('imageEditorSessions');
    console.log('[DEBUG] Found sessions in localStorage:', storedSessions);
    
    if (storedSessions) {
      const sessionsArray = JSON.parse(storedSessions);
      console.log('[DEBUG] Parsed sessions:', sessionsArray);
      
      sessionsArray.forEach((session: SessionData) => {
        console.log('[DEBUG] Adding session to in-memory store:', session.id);
        sessions.set(session.id, session);
      });
      
      console.log('[DEBUG] After initialization, sessions map size:', sessions.size);
    }
  } catch (error) {
    console.error('[DEBUG] Error loading sessions from localStorage:', error);
  }
}

// Save sessions to localStorage
const persistSessions = () => {
  if (typeof window !== 'undefined') {
    try {
      console.log('[DEBUG] Persisting sessions to localStorage');
      const sessionsArray = Array.from(sessions.values());
      console.log('[DEBUG] Sessions to persist:', sessionsArray);
      
      localStorage.setItem('imageEditorSessions', JSON.stringify(sessionsArray));
      
      // Verify it was saved
      const savedSessions = localStorage.getItem('imageEditorSessions');
      console.log('[DEBUG] Verified localStorage after save:', savedSessions);
    } catch (error) {
      console.error('[DEBUG] Error saving sessions to localStorage:', error);
    }
  }
};

/**
 * Creates a new session or retrieves existing one
 */
export const getOrCreateSession = (sessionId?: string): SessionData => {
  console.log('[DEBUG] getOrCreateSession called with sessionId:', sessionId);
  
  // Clean expired sessions
  cleanExpiredSessions();
  
  // If sessionId is provided and exists, return that session
  if (sessionId && sessions.has(sessionId)) {
    console.log('[DEBUG] Found existing session:', sessionId);
    const session = sessions.get(sessionId)!;
    console.log('[DEBUG] Session tokens:', session.tokens);
    return session;
  }
  
  // Create new session
  console.log('[DEBUG] Creating new session');
  const newSession: SessionData = {
    id: uuidv4(),
    tokens: 0,
    createdAt: Date.now(),
  };
  
  console.log('[DEBUG] New session created:', newSession.id);
  sessions.set(newSession.id, newSession);
  persistSessions();
  return newSession;
};

/**
 * Add tokens to a session
 */
export const addTokens = (sessionId: string, amount: number): SessionData => {
  console.log('[DEBUG] addTokens called with sessionId:', sessionId, 'amount:', amount);
  console.log('[DEBUG] Current sessions:', Array.from(sessions.entries()));
  
  let session: SessionData;
  
  if (!sessions.has(sessionId)) {
    console.log('[DEBUG] Session not found, creating new session with ID:', sessionId);
    // Instead of throwing an error, create a new session with the given ID
    session = {
      id: sessionId,
      tokens: 0, // Will add the amount below
      createdAt: Date.now(),
    };
    sessions.set(sessionId, session);
  } else {
    session = sessions.get(sessionId)!;
  }
  
  console.log('[DEBUG] Original token count:', session.tokens);
  
  session.tokens += amount;
  console.log('[DEBUG] New token count:', session.tokens);
  
  sessions.set(sessionId, session);
  persistSessions();
  
  return session;
};

/**
 * Use a token from a session
 */
export const useToken = (sessionId: string): boolean => {
  console.log('[DEBUG] useToken called with sessionId:', sessionId);
  
  if (!sessions.has(sessionId)) {
    console.log('[DEBUG] Session not found:', sessionId);
    return false;
  }
  
  const session = sessions.get(sessionId)!;
  if (session.tokens <= 0) {
    console.log('[DEBUG] Insufficient tokens:', session.tokens);
    return false;
  }
  
  session.tokens -= 1;
  console.log('[DEBUG] Token used, new count:', session.tokens);
  
  sessions.set(sessionId, session);
  persistSessions();
  return true;
};

/**
 * Get remaining tokens for a session
 */
export const getTokenCount = (sessionId: string): number => {
  console.log('[DEBUG] getTokenCount called with sessionId:', sessionId);
  
  if (!sessions.has(sessionId)) {
    console.log('[DEBUG] Session not found, returning 0');
    return 0;
  }
  
  const tokenCount = sessions.get(sessionId)!.tokens;
  console.log('[DEBUG] Token count for session:', tokenCount);
  return tokenCount;
};

/**
 * Clean expired sessions
 */
const cleanExpiredSessions = (): void => {
  console.log('[DEBUG] Cleaning expired sessions');
  
  const now = Date.now();
  const sessionsToRemove: string[] = [];
  
  // Collect keys of expired sessions
  sessions.forEach((session, id) => {
    if (now - session.createdAt > SESSION_EXPIRATION) {
      console.log('[DEBUG] Found expired session:', id);
      sessionsToRemove.push(id);
    }
  });
  
  // Remove expired sessions
  sessionsToRemove.forEach(id => {
    console.log('[DEBUG] Removing expired session:', id);
    sessions.delete(id);
  });
  
  if (sessionsToRemove.length > 0) {
    // Persist the changes only if we removed something
    persistSessions();
  }
}; 