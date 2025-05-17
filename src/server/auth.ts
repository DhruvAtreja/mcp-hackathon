import { Request, Response, NextFunction } from 'express';

// This is a placeholder. In a real application, you would:
// 1. Extract the token from the Authorization header (e.g., Bearer token).
// 2. Validate the token (e.g., against a database of tokens or by verifying a JWT).
// 3. If valid, identify the user and attach user information to the request object (e.g., req.user).
// 4. If invalid, respond with a 401 Unauthorized error.

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authToken = req.headers.authorization;

  // For MCP routes, we will enforce token validation later.
  // For now, let's simulate a basic check or allow if no token provided for easier testing.
  if (req.path.startsWith('/mcp')) {
    if (!authToken || !authToken.startsWith('Bearer ')) {
      // For now, we can allow requests without tokens for easier initial testing of MCP server
      // In a real scenario, you'd return a 401 here if the token is missing or malformed.
      // console.warn('MCP route accessed without proper Bearer token.');
      // return res.status(401).json({ message: 'Unauthorized: Bearer token required' });
    }
    // else {
      // const token = authToken.split(' ')[1];
      // TODO: Validate token and fetch user
      // console.log('MCP Token:', token); 
    // }
  }

  // For non-MCP routes, allow access if no specific auth is required for them yet.
  console.log('Auth middleware called for path:', req.path);
  next();
};

// Authentication logic 