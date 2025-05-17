import { Request, Response, NextFunction } from 'express';
import { getDb } from '@src/db/models'; // For inserting mock user
import { v4 as uuidv4 } from 'uuid';

// Define a custom request type that includes the user property
export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

// Mock user details
const MOCK_USER_ID = 'test_user_1_uuid';
const MOCK_USERNAME = 'testuser1';
const MOCK_AUTH_TOKEN = 'test_user_1_token'; // This is the token we expect in Authorization: Bearer <token>

// Function to ensure mock user exists in the database
async function ensureMockUserExists() {
  const db = getDb();
  try {
    const existingUser = await db.get('SELECT id FROM User WHERE id = ?', MOCK_USER_ID);
    if (!existingUser) {
      await db.run(
        'INSERT INTO User (id, username, auth_token) VALUES (?, ?, ?)',
        MOCK_USER_ID,
        MOCK_USERNAME,
        // In a real app, this would be a hashed token or a reference to an auth system token
        // For mock purposes, storing the bearer token identifier directly for simplicity.
        MOCK_AUTH_TOKEN 
      );
      console.log(`Mock user ${MOCK_USERNAME} created with ID ${MOCK_USER_ID}`);
    }
  } catch (error) {
    console.error('Error ensuring mock user exists:', error);
  }
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Ensure mock user exists (ideally call this once at startup, but for simplicity here)
  // Or better, have a seeding script. For now, this ensures it before first auth check.
  await ensureMockUserExists(); 

  const authHeader = req.headers.authorization;
  console.log('Auth middleware called for path:', req.path);

  if (req.path.startsWith('/mcp')) {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token === MOCK_AUTH_TOKEN) {
        // Attach mock user to request object
        req.user = { id: MOCK_USER_ID, username: MOCK_USERNAME };
        console.log(`Authenticated mock user ${MOCK_USERNAME}`);
      } else {
        // Invalid token for /mcp path
        // console.warn('MCP route accessed with invalid Bearer token.');
        // return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        // For Phase 2, we'll be more strict: if a token is provided but it's not the mock one, deny access.
        // If no token is provided, we might still allow for some tools if they don't require auth (not this one).
        return res.status(401).json({ message: 'Unauthorized: Invalid Bearer token for MCP route' });
      }
    } else {
      // No token provided for /mcp path
      // console.warn('MCP route accessed without Bearer token.');
      // For save_memory, auth is required.
      return res.status(401).json({ message: 'Unauthorized: Bearer token required for MCP route' });
    }
  }
  next();
};

// Authentication logic 