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
exports.registerRetrieveSharedMemoryTool = exports.registerUseAccessTokenTool = exports.registerCreateAccessTokenTool = void 0;
const zod_1 = require("zod");
const uuid_1 = require("uuid"); // For generating unique IDs
const models_js_1 = require("../db/models.js"); // Import getDb
const models_js_2 = require("../db/models.js"); // Import user constants
// Assume RequestHandlerExtra and CallToolResult are imported if a more specific type is needed
// import { RequestHandlerExtra, CallToolResult } from "@modelcontextprotocol/sdk/server/mcp.js"; 
// Helper function to generate a human-friendly token phrase
// This is a simplified example. You might want a more robust generation strategy.
function generateHumanFriendlyToken() {
    const adjectives = ["purple", "quick", "happy", "sleepy", "bright", "fuzzy"];
    const nouns = ["mountain", "river", "sunset", "forest", "meadow", "ocean"];
    const numbers = Math.floor(Math.random() * 100);
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}_${numbers}`;
}
const createAccessTokenToolInputSchema = zod_1.z.object({
    access_level: zod_1.z.enum(["read", "write"]).describe("Level of access to grant"),
    expiration_hours: zod_1.z.number().describe("Number of hours until token expires").default(24),
});
// Define the tool structure directly as an object for server.tool()
const createAccessTokenToolDefinition = {
    name: "create_access_token",
    description: "Generate a shareable access token for another user",
    handler: (params, extra) => __awaiter(void 0, void 0, void 0, function* () {
        const db = (0, models_js_1.getDb)();
        // Use DEFAULT_TEST_USER_ID if authenticatedUserId is not available from context
        const granter_user_id = (extra === null || extra === void 0 ? void 0 : extra.authenticatedUserId) || models_js_2.DEFAULT_TEST_USER_ID;
        const user = yield db.get('SELECT * FROM User WHERE id = ?', granter_user_id);
        if (!user) {
            throw new Error(`Granter user with ID ${granter_user_id} not found. Ensure this user exists in the DB.`);
        }
        const tokenPhrase = generateHumanFriendlyToken();
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + params.expiration_hours * 60 * 60 * 1000);
        const tokenId = (0, uuid_1.v4)();
        yield db.run('INSERT INTO AccessToken (id, token, granter_user_id, access_level, created_at, expires_at, is_used) VALUES (?, ?, ?, ?, ?, ?, ?)', tokenId, tokenPhrase, user.id, params.access_level, createdAt.toISOString(), expiresAt.toISOString(), false);
        const message = `Access token generated. Token Phrase: '${tokenPhrase}'. Access Level: ${params.access_level}. Expires: ${expiresAt.toISOString()}. Share this phrase to grant access.`;
        return {
            // Only return content if no outputSchema is defined for the tool
            content: [{ type: "text", text: message }]
        };
    })
};
// Function to register this tool with an McpServer instance
function registerCreateAccessTokenTool(server) {
    server.tool(createAccessTokenToolDefinition.name, createAccessTokenToolInputSchema.shape, // Pass the .shape of the Zod schema
    createAccessTokenToolDefinition.handler);
    console.log(`Tool registered: ${createAccessTokenToolDefinition.name}`);
}
exports.registerCreateAccessTokenTool = registerCreateAccessTokenTool;
const useAccessTokenToolInputSchema = zod_1.z.object({
    token: zod_1.z.string().describe("The access token phrase"),
    granter_username: zod_1.z.string().describe("Username of the person who granted access (for verification)"),
});
const useAccessTokenToolDefinition = {
    name: "use_access_token",
    description: "Use an access token to gain permissions to another user's memories",
    handler: (params, extra) => __awaiter(void 0, void 0, void 0, function* () {
        const db = (0, models_js_1.getDb)();
        const { token, granter_username } = params;
        const storedToken = yield db.get('SELECT * FROM AccessToken WHERE token = ?', token);
        if (!storedToken)
            throw new Error("Access token not found.");
        // Convert stored dates from ISO strings to Date objects if needed for comparison, or compare as strings/timestamps
        if (storedToken.is_used)
            throw new Error("Access token has already been used.");
        if (new Date(storedToken.expires_at) < new Date())
            throw new Error("Access token has expired.");
        const granterUser = yield db.get('SELECT * FROM User WHERE id = ? AND username = ?', storedToken.granter_user_id, granter_username);
        if (!granterUser)
            throw new Error("Invalid granter username for this token, or granter not found.");
        // Optionally mark token as used if it's one-time use for validation
        // await db.run('UPDATE AccessToken SET is_used = TRUE WHERE id = ?', storedToken.id);
        const message = `Access token '${token}' successfully validated. Granted Access Level: ${storedToken.access_level}. Granter: ${granterUser.username}. Expires: ${storedToken.expires_at}`;
        return {
            content: [{ type: "text", text: message }]
        };
    })
};
function registerUseAccessTokenTool(server) {
    server.tool(useAccessTokenToolDefinition.name, useAccessTokenToolInputSchema.shape, useAccessTokenToolDefinition.handler);
    console.log(`Tool registered: ${useAccessTokenToolDefinition.name}`);
}
exports.registerUseAccessTokenTool = registerUseAccessTokenTool;
const retrieveSharedMemoryInputSchema = zod_1.z.object({
    shared_by_username: zod_1.z.string().describe("Username of the person who shared the memories"),
    query: zod_1.z.string().describe("Search query for the memories"),
    // Optional: access_token if direct token-based auth is used for retrieval per query
    // access_token: z.string().optional().describe("Access token if required for this query") 
});
const retrieveSharedMemoryToolDefinition = {
    name: "retrieve_shared_memory",
    description: "Retrieve memories shared by another user based on a query",
    handler: (params, extra) => __awaiter(void 0, void 0, void 0, function* () {
        const db = (0, models_js_1.getDb)();
        const { shared_by_username, query } = params;
        // Use ANOTHER_TEST_USER_ID as the requester if not available from context
        const requester_user_id = (extra === null || extra === void 0 ? void 0 : extra.authenticatedUserId) || models_js_2.ANOTHER_TEST_USER_ID;
        const memoryOwner = yield db.get('SELECT * FROM User WHERE username = ?', shared_by_username);
        if (!memoryOwner)
            throw new Error(`User \"${shared_by_username}\" (memory owner) not found.`);
        let hasPermission = false;
        let accessLevel = "read";
        // Check direct AccessPermission table
        const directPermission = yield db.get('SELECT * FROM AccessPermission WHERE granter_user_id = ? AND grantee_user_id = ?', memoryOwner.id, requester_user_id);
        if (directPermission && (directPermission.access_level === "read" || directPermission.access_level === "write")) {
            hasPermission = true;
            accessLevel = directPermission.access_level;
        }
        // Simplified conceptual check for token-based auth passed via 'extra' from LLM/client context
        // This assumes the LLM, after a successful `use_access_token` call, might pass a flag or specific
        // validated details in the `extra` object for subsequent related calls.
        if (!hasPermission &&
            (extra === null || extra === void 0 ? void 0 : extra.validated_token_for_owner) === memoryOwner.id &&
            (extra.validated_token_access_level === "read" || extra.validated_token_access_level === "write")) {
            console.log("Access granted via token context passed in 'extra' for owner: ", memoryOwner.id);
            hasPermission = true;
            accessLevel = extra.validated_token_access_level;
        }
        if (!hasPermission)
            throw new Error(`User '${requester_user_id}' does not have permission to access memories from '${shared_by_username}'.`);
        const memories = yield db.all(`SELECT id, content, createdAt FROM Memory WHERE user_id = ? AND content LIKE ? ORDER BY createdAt DESC LIMIT 10`, memoryOwner.id, `%${query}%`);
        let message;
        if (memories.length > 0) {
            const memoriesText = memories.map(m => `  - ID: ${m.id}, Content: "${m.content}", Created: ${new Date(m.createdAt).toLocaleDateString()}`).join("\n");
            message = `Found ${memories.length} shared memories from '${shared_by_username}' matching query '${query}' (using ${accessLevel} access):\n${memoriesText}`;
        }
        else {
            message = `No shared memories found from '${shared_by_username}' matching query '${query}'.`;
        }
        return {
            content: [{ type: "text", text: message }]
        };
    })
};
function registerRetrieveSharedMemoryTool(server) {
    server.tool(retrieveSharedMemoryToolDefinition.name, retrieveSharedMemoryInputSchema.shape, retrieveSharedMemoryToolDefinition.handler);
    console.log(`Tool registered: ${retrieveSharedMemoryToolDefinition.name}`);
}
exports.registerRetrieveSharedMemoryTool = registerRetrieveSharedMemoryTool;
