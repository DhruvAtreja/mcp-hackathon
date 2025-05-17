// access-control tool 
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { getDb } from "../db/models.js"; // Import getDb
import { DEFAULT_TEST_USER_ID, DEFAULT_TEST_USERNAME, ANOTHER_TEST_USER_ID, ANOTHER_TEST_USERNAME } from "../db/models.js"; // Import user constants
// Assume RequestHandlerExtra and CallToolResult are imported if a more specific type is needed
// import { RequestHandlerExtra, CallToolResult } from "@modelcontextprotocol/sdk/server/mcp.js"; 

// Helper function to generate a human-friendly token phrase
// This is a simplified example. You might want a more robust generation strategy.
function generateHumanFriendlyToken(): string {
  const adjectives = ["purple", "quick", "happy", "sleepy", "bright", "fuzzy"];
  const nouns = ["mountain", "river", "sunset", "forest", "meadow", "ocean"];
  const numbers = Math.floor(Math.random() * 100);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}_${numbers}`;
}

const createAccessTokenToolInputSchema = z.object({
  access_level: z.enum(["read", "write"]).describe("Level of access to grant"),
  expiration_hours: z.number().describe("Number of hours until token expires").default(24),
});

// Define the tool structure directly as an object for server.tool()
const createAccessTokenToolDefinition = {
  name: "create_access_token",
  description: "Generate a shareable access token for another user",
  handler: async (params: z.infer<typeof createAccessTokenToolInputSchema>, extra: any) => {
    const db = getDb();
    // Use DEFAULT_TEST_USER_ID if authenticatedUserId is not available from context
    const granter_user_id = extra?.authenticatedUserId || DEFAULT_TEST_USER_ID; 

    const user = await db.get('SELECT * FROM User WHERE id = ?', granter_user_id);
    if (!user) {
      throw new Error(`Granter user with ID ${granter_user_id} not found. Ensure this user exists in the DB.`);
    }

    const tokenPhrase = generateHumanFriendlyToken();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + params.expiration_hours * 60 * 60 * 1000);
    const tokenId = uuidv4();

    await db.run(
      'INSERT INTO AccessToken (id, token, granter_user_id, access_level, created_at, expires_at, is_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
      tokenId, tokenPhrase, user.id, params.access_level, createdAt.toISOString(), expiresAt.toISOString(), false
    );
    
    const message = `Access token generated. Token Phrase: '${tokenPhrase}'. Access Level: ${params.access_level}. Expires: ${expiresAt.toISOString()}. Share this phrase to grant access.`;
    return {
      // Only return content if no outputSchema is defined for the tool
      content: [{ type: "text" as const, text: message }]
    };
  }
};

// Function to register this tool with an McpServer instance
export function registerCreateAccessTokenTool(server: McpServer) {
  server.tool(
    createAccessTokenToolDefinition.name,
    createAccessTokenToolInputSchema.shape, // Pass the .shape of the Zod schema
    createAccessTokenToolDefinition.handler
  );
  console.log(`Tool registered: ${createAccessTokenToolDefinition.name}`);
}

const useAccessTokenToolInputSchema = z.object({
  token: z.string().describe("The access token phrase"),
  granter_username: z.string().describe("Username of the person who granted access (for verification)"),
});

const useAccessTokenToolDefinition = {
  name: "use_access_token",
  description: "Use an access token to gain permissions to another user's memories",
  handler: async (params: z.infer<typeof useAccessTokenToolInputSchema>, extra: any) => {
    const db = getDb();
    const { token, granter_username } = params;

    const storedToken = await db.get('SELECT * FROM AccessToken WHERE token = ?', token);
    if (!storedToken) throw new Error("Access token not found.");
    // Convert stored dates from ISO strings to Date objects if needed for comparison, or compare as strings/timestamps
    if (storedToken.is_used) throw new Error("Access token has already been used.");
    if (new Date(storedToken.expires_at) < new Date()) throw new Error("Access token has expired.");

    const granterUser = await db.get('SELECT * FROM User WHERE id = ? AND username = ?', storedToken.granter_user_id, granter_username);
    if (!granterUser) throw new Error("Invalid granter username for this token, or granter not found.");

    // Optionally mark token as used if it's one-time use for validation
    // await db.run('UPDATE AccessToken SET is_used = TRUE WHERE id = ?', storedToken.id);

    const message = `Access token '${token}' successfully validated. Granted Access Level: ${storedToken.access_level}. Granter: ${granterUser.username}. Expires: ${storedToken.expires_at}`;
    return {
      content: [{ type: "text" as const, text: message }]
    };
  }
};

export function registerUseAccessTokenTool(server: McpServer) {
  server.tool(
    useAccessTokenToolDefinition.name,
    useAccessTokenToolInputSchema.shape,
    useAccessTokenToolDefinition.handler
  );
  console.log(`Tool registered: ${useAccessTokenToolDefinition.name}`);
}

const retrieveSharedMemoryInputSchema = z.object({
  shared_by_username: z.string().describe("Username of the person who shared the memories"),
  query: z.string().describe("Search query for the memories"),
  // Optional: access_token if direct token-based auth is used for retrieval per query
  // access_token: z.string().optional().describe("Access token if required for this query") 
});

const retrieveSharedMemoryToolDefinition = {
  name: "retrieve_shared_memory",
  description: "Retrieve memories shared by another user based on a query",
  handler: async (params: z.infer<typeof retrieveSharedMemoryInputSchema>, extra: any) => {
    const db = getDb();
    const { shared_by_username, query } = params;
    // Use ANOTHER_TEST_USER_ID as the requester if not available from context
    const requester_user_id = extra?.authenticatedUserId || ANOTHER_TEST_USER_ID; 

    const memoryOwner = await db.get('SELECT * FROM User WHERE username = ?', shared_by_username);
    if (!memoryOwner) throw new Error(`User \"${shared_by_username}\" (memory owner) not found.`);

    let hasPermission = false;
    let accessLevel: "read" | "write" = "read";

    // Check direct AccessPermission table
    const directPermission = await db.get(
      'SELECT * FROM AccessPermission WHERE granter_user_id = ? AND grantee_user_id = ?',
      memoryOwner.id, requester_user_id
    );

    if (directPermission && (directPermission.access_level === "read" || directPermission.access_level === "write")) {
      hasPermission = true;
      accessLevel = directPermission.access_level;
    }
    
    // Simplified conceptual check for token-based auth passed via 'extra' from LLM/client context
    // This assumes the LLM, after a successful `use_access_token` call, might pass a flag or specific
    // validated details in the `extra` object for subsequent related calls.
    if (!hasPermission && 
        extra?.validated_token_for_owner === memoryOwner.id && 
        (extra.validated_token_access_level === "read" || extra.validated_token_access_level === "write")) {
      console.log("Access granted via token context passed in 'extra' for owner: ", memoryOwner.id);
      hasPermission = true;
      accessLevel = extra.validated_token_access_level;
    }

    if (!hasPermission) throw new Error(`User '${requester_user_id}' does not have permission to access memories from '${shared_by_username}'.`);

    const memories = await db.all(
      `SELECT id, content, createdAt FROM Memory WHERE user_id = ? AND content LIKE ? ORDER BY createdAt DESC LIMIT 10`,
      memoryOwner.id, `%${query}%`
    );
    
    let message: string;
    if (memories.length > 0) {
      const memoriesText = memories.map(m => `  - ID: ${m.id}, Content: "${m.content}", Created: ${new Date(m.createdAt).toLocaleDateString()}`).join("\n");
      message = `Found ${memories.length} shared memories from '${shared_by_username}' matching query '${query}' (using ${accessLevel} access):\n${memoriesText}`;
    } else {
      message = `No shared memories found from '${shared_by_username}' matching query '${query}'.`;
    }
        
    return {
      content: [{ type: "text" as const, text: message }]
    };
  }
};

export function registerRetrieveSharedMemoryTool(server: McpServer) {
  server.tool(
    retrieveSharedMemoryToolDefinition.name,
    retrieveSharedMemoryInputSchema.shape,
    retrieveSharedMemoryToolDefinition.handler
  );
  console.log(`Tool registered: ${retrieveSharedMemoryToolDefinition.name}`);
} 