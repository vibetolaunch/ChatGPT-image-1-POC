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

/**
 * Creates a new session or retrieves existing one
 */
export const getOrCreateSession = (sessionId?: string): SessionData => {
  // Clean expired sessions
  cleanExpiredSessions();
  
  // If sessionId is provided and exists, return that session
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }
  
  // Create new session
  const newSession: SessionData = {
    id: uuidv4(),
    tokens: 0,
    createdAt: Date.now(),
  };
  
  sessions.set(newSession.id, newSession);
  return newSession;
};

/**
 * Add tokens to a session
 */
export const addTokens = (sessionId: string, amount: number): SessionData => {
  if (!sessions.has(sessionId)) {
    throw new Error('Session not found');
  }
  
  const session = sessions.get(sessionId)!;
  session.tokens += amount;
  sessions.set(sessionId, session);
  
  return session;
};

/**
 * Use a token from a session
 */
export const useToken = (sessionId: string): boolean => {
  if (!sessions.has(sessionId)) {
    return false;
  }
  
  const session = sessions.get(sessionId)!;
  if (session.tokens <= 0) {
    return false;
  }
  
  session.tokens -= 1;
  sessions.set(sessionId, session);
  return true;
};

/**
 * Get remaining tokens for a session
 */
export const getTokenCount = (sessionId: string): number => {
  if (!sessions.has(sessionId)) {
    return 0;
  }
  
  return sessions.get(sessionId)!.tokens;
};

/**
 * Clean expired sessions
 */
const cleanExpiredSessions = (): void => {
  const now = Date.now();
  const sessionsToRemove: string[] = [];
  
  // Collect keys of expired sessions
  sessions.forEach((session, id) => {
    if (now - session.createdAt > SESSION_EXPIRATION) {
      sessionsToRemove.push(id);
    }
  });
  
  // Remove expired sessions
  sessionsToRemove.forEach(id => {
    sessions.delete(id);
  });
}; 