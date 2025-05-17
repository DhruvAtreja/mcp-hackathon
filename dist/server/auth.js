"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const models_1 = require("@src/db/models"); // For inserting mock user
// Mock user details
const MOCK_USER_ID = 'test_user_1_uuid';
const MOCK_USERNAME = 'testuser1';
const MOCK_AUTH_TOKEN = 'test_user_1_token'; // This is the token we expect in Authorization: Bearer <token>
// Function to ensure mock user exists in the database
function ensureMockUserExists() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = (0, models_1.getDb)();
        try {
            const existingUser = yield db.get('SELECT id FROM User WHERE id = ?', MOCK_USER_ID);
            if (!existingUser) {
                yield db.run('INSERT INTO User (id, username, auth_token) VALUES (?, ?, ?)', MOCK_USER_ID, MOCK_USERNAME, 
                // In a real app, this would be a hashed token or a reference to an auth system token
                // For mock purposes, storing the bearer token identifier directly for simplicity.
                MOCK_AUTH_TOKEN);
                console.log(`Mock user ${MOCK_USERNAME} created with ID ${MOCK_USER_ID}`);
            }
        }
        catch (error) {
            console.error('Error ensuring mock user exists:', error);
        }
    });
}
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Ensure mock user exists (ideally call this once at startup, but for simplicity here)
    // Or better, have a seeding script. For now, this ensures it before first auth check.
    yield ensureMockUserExists();
    const authHeader = req.headers.authorization;
    console.log('Auth middleware called for path:', req.path);
    if (req.path.startsWith('/mcp')) {
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token === MOCK_AUTH_TOKEN) {
                // Attach mock user to request object
                req.user = { id: MOCK_USER_ID, username: MOCK_USERNAME };
                console.log(`Authenticated mock user ${MOCK_USERNAME}`);
            }
            else {
                // Invalid token for /mcp path
                // console.warn('MCP route accessed with invalid Bearer token.');
                // return res.status(401).json({ message: 'Unauthorized: Invalid token' });
                // For Phase 2, we'll be more strict: if a token is provided but it's not the mock one, deny access.
                // If no token is provided, we might still allow for some tools if they don't require auth (not this one).
                return res.status(401).json({ message: 'Unauthorized: Invalid Bearer token for MCP route' });
            }
        }
        else {
            // No token provided for /mcp path
            // console.warn('MCP route accessed without Bearer token.');
            // For save_memory, auth is required.
            return res.status(401).json({ message: 'Unauthorized: Bearer token required for MCP route' });
        }
    }
    next();
});
exports.authMiddleware = authMiddleware;
// Authentication logic 
