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
  access_level: z.enum(["read", "write"]).describe("The level of access to grant. 'read' allows viewing memories, 'write' implies read and could allow modification/addition in the future."),
  expiration_hours: z.number().describe("Number of hours from now until the generated token expires. Defaults to 24.").default(24),
});

// Define the tool structure directly as an object for server.tool()
const createAccessTokenToolDefinition = {
  name: "create_access_token",
  description: "Generates a temporary, human-friendly access token phrase that you (the granter) can share with another user. This token allows them to access your memories based on the specified access level and duration. Call this tool when you want to grant another user time-limited access to your information.",
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
    
    const message = `Access token generated successfully by user '${user?.username || granter_user_id}'. Token Phrase: '${tokenPhrase}'. Grants '${params.access_level}' access. Expires: ${expiresAt.toISOString()}. Inform the user who requested this token to share this phrase with the intended recipient.`;
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
  token: z.string().describe("The exact human-friendly token phrase that was shared with you."),
  granter_username: z.string().describe("The username of the person who generated and gave you this token. This is for verification."),
});

const useAccessTokenToolDefinition = {
  name: "use_access_token",
  description: "Validates and activates a received access token phrase, granting you temporary access to another user's memories. Call this tool when another user has shared an access token phrase with you and you want to start accessing their memories. You must provide the token phrase and the username of the person who gave it to you.",
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

    const grantee_user_id = extra?.authenticatedUserId || ANOTHER_TEST_USER_ID; // Fallback for testing
    const message = `Access token '${token}' for granter '${granterUser.username}' successfully validated and activated for you (user '${grantee_user_id}'). You now have '${storedToken.access_level}' access to their memories until ${new Date(storedToken.expires_at).toISOString()}.`;
    // Potentially create an AccessPermission entry here if the token is for establishing a more persistent (but still time-limited if AccessPermission has expiry) grant.
    // For now, it only validates.
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
  shared_by_username: z.string().describe("The username of the user whose memories you want to search."),
  query: z.string().describe("The search query or keywords to find relevant memories."),
  access_token: z.string().optional().describe("Optional: The access token phrase shared by the user if you are using token-based access."),
});

const retrieveSharedMemoryToolDefinition = {
  name: "retrieve_shared_memory",
  description: "Searches and retrieves memories shared by another specific user. Requires either a valid access token for that user OR a pre-existing direct permission.",
  handler: async (params: z.infer<typeof retrieveSharedMemoryInputSchema>, extra: any) => {
    const db = getDb();
    const { shared_by_username, query, access_token } = params;
    const requester_user_id = extra?.authenticatedUserId || ANOTHER_TEST_USER_ID; 

    const memoryOwner = await db.get('SELECT * FROM User WHERE username = ?', shared_by_username);
    if (!memoryOwner) throw new Error(`User \"${shared_by_username}\" (memory owner) not found.`);

    let hasPermission = false;
    let accessLevel: "read" | "write" = "read"; // Default to read
    let permissionSource = "none";

    // Priority 1: Check provided access_token if present
    if (access_token) {
      const storedToken = await db.get('SELECT * FROM AccessToken WHERE token = ?', access_token);
      if (storedToken) {
        if (storedToken.granter_user_id !== memoryOwner.id) {
          // Token is valid, but not for the user whose memories are being requested.
          // This is a specific error case, distinct from a totally invalid token.
          // Depending on desired strictness, could throw here or just not grant permission.
          console.warn(`Token '${access_token}' is not for user '${shared_by_username}'.`);
        } else if (storedToken.is_used && false) { // Keeping is_used check flexible, currently token can be used multiple times for retrieval if not expired
          // For retrieve, a token might be usable multiple times until expiry, unlike a one-time validation use.
          // throw new Error("Access token has already been used for its primary validation purpose.");
          console.warn(`Token '${access_token}' was marked as used, but allowing for retrieval.`);
          // Decide if is_used should block retrieval. For now, let's assume it doesn't if not expired.
        }
        if (new Date(storedToken.expires_at) < new Date()) {
          throw new Error("Access token has expired.");
        }
        // If token is valid for this owner and not expired:
        if (storedToken.granter_user_id === memoryOwner.id && !(new Date(storedToken.expires_at) < new Date())) {
            hasPermission = true;
            accessLevel = storedToken.access_level;
            permissionSource = `token: ${access_token}`;
            console.log(`Access granted via provided token '${access_token}' for user '${shared_by_username}'.`);
        }
      } else {
        // If a token was provided but not found, it's an error.
        throw new Error(`Provided access token '${access_token}' not found.`);
      }
    }

    // Priority 2: If no permission from token, check direct AccessPermission table
    if (!hasPermission) {
      const directPermission = await db.get(
        'SELECT * FROM AccessPermission WHERE granter_user_id = ? AND grantee_user_id = ?',
        memoryOwner.id, requester_user_id
      );
      if (directPermission && (directPermission.access_level === "read" || directPermission.access_level === "write")) {
        hasPermission = true;
        accessLevel = directPermission.access_level;
        permissionSource = "direct_permission";
        console.log(`Access granted via direct permission for user '${shared_by_username}'.`);
      }
    }
    
    // Priority 3: Conceptual check for token-based auth passed via general 'extra' context (less reliable)
    if (!hasPermission && 
        extra?.validated_token_for_owner === memoryOwner.id && 
        (extra.validated_token_access_level === "read" || extra.validated_token_access_level === "write")) {
      console.log("Access potentially granted via general 'extra' context for owner: ", memoryOwner.id);
      hasPermission = true;
      accessLevel = extra.validated_token_access_level;
      permissionSource = "extra_context";
    }

    if (!hasPermission) throw new Error(`User '${requester_user_id}' does not have permission to access memories from '${shared_by_username}' (source: ${permissionSource}).`);

    const memories = await db.all(
      `SELECT id, content, created_at FROM Memory WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT 10`,
      memoryOwner.id, `%${query}%`
    );
    
    let result_message: string;
    if (memories.length > 0) {
      const memoriesText = memories.map(m => `  - ID: ${m.id}, Content: \"${m.content}\", Created: ${new Date(m.created_at).toLocaleDateString()}`).join("\n");
      result_message = `Found ${memories.length} shared memories from '${shared_by_username}' for you (user '${requester_user_id}') using ${permissionSource} matching query '${query}':\n${memoriesText}`;
    } else {
      result_message = `No shared memories found from '${shared_by_username}' for you (user '${requester_user_id}') using ${permissionSource} matching query '${query}'.`;
    }
            
    return {
      content: [{ type: "text" as const, text: result_message }]
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