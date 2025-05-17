// access-control tool 
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
// Assume db is imported and configured elsewhere, e.g., import { db } from '../db/database';
// Assume User type/interface is defined, e.g., import { User } from '../db/models';
// Assume RequestHandlerExtra and CallToolResult are imported if a more specific type is needed
// import { RequestHandlerExtra, CallToolResult } from "@modelcontextprotocol/sdk/server/mcp.js"; 

// Define the full structure of the mock DB upfront for TypeScript
const db = {
  users: {
    async findById(id: string): Promise<{ id: string; username: string } | null> {
      if (id === "authenticated_user_id_placeholder" || id === "requesting_user_id_placeholder") { 
        return { id, username: id === "authenticated_user_id_placeholder" ? "testuser" : "requesteruser" };
      }
      return null;
    },
    async findByUsername(username: string): Promise<{ id: string; username: string } | null> {
      if (username === "testuser") {
        return { id: "authenticated_user_id_placeholder", username: "testuser" };
      }
      if (username === "requesteruser") {
        return { id: "requesting_user_id_placeholder", username: "requesteruser" };
      }
      return null;
    }
  },
  accessTokens: {
    async create(data: {
      id: string; token: string; granter_user_id: string; access_level: "read" | "write";
      created_at: Date; expires_at: Date; is_used: boolean;
    }): Promise<any> {
      console.log("DB: Creating access token", data);
      return { ...data };
    },
    async findByToken(token: string): Promise<any | null> {
      console.log("DB: Finding access token", token);
      if (token === "purple_mountain_42" || token.includes("_")) {
        return {
          id: "mock_token_id", token: token, granter_user_id: "authenticated_user_id_placeholder",
          access_level: "read", created_at: new Date(Date.now() - 3600 * 1000),
          expires_at: new Date(Date.now() + 23 * 3600 * 1000), is_used: false,
        };
      }
      return null;
    },
    async markAsUsed(tokenId: string): Promise<any> {
      console.log("DB: Marking token as used", tokenId);
      return { id: tokenId, is_used: true };
    }
  },
  memories: {
    async search(userId: string, query: string, accessLevel: "read" | "write"): Promise<Array<{ id: string; content: string; relevance: number }>> {
      console.log(`DB: Searching memories for user ${userId} with query "${query}" and access ${accessLevel}`);
      if (userId === "authenticated_user_id_placeholder" && query.includes("design decisions")) {
        return [
          { id: "mem1", content: "Key design decision: Use React for frontend.", relevance: 0.9 },
          { id: "mem2", content: "Key design decision: Node.js for backend.", relevance: 0.85 },
        ];
      }
      if (userId === "authenticated_user_id_placeholder" && query.includes("notes")) {
         return [{ id: "mem3", content: "Project notes: initial setup complete.", relevance: 0.7 }];
      }
      return [];
    }
  },
  accessPermissions: {
    async find(granter_user_id: string, grantee_user_id: string): Promise<{ id: string; access_level: "read" | "write" } | null> {
      console.log(`DB: Checking direct permission from ${granter_user_id} to ${grantee_user_id}`);
      if (granter_user_id === "authenticated_user_id_placeholder" && grantee_user_id === "requesting_user_id_placeholder") {
        return { id: "perm1", access_level: "read" };
      }
      return null;
    }
  }
};

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
  // inputSchema: createAccessTokenToolInputSchema, // Keep ZodObject for type inference in handler if needed
  handler: async (params: z.infer<typeof createAccessTokenToolInputSchema>, extra: any /* Replace 'any' with RequestHandlerExtra */) => {
    const granter_user_id = extra?.authenticatedUserId || "authenticated_user_id_placeholder";

    if (!granter_user_id) {
      throw new Error("User authentication failed or granter_user_id not provided.");
    }

    const user = await db.users.findById(granter_user_id);
    if (!user) {
      throw new Error(`Granter user with ID ${granter_user_id} not found.`);
    }

    const tokenPhrase = generateHumanFriendlyToken();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + params.expiration_hours * 60 * 60 * 1000);

    const accessTokenData = {
      id: uuidv4(),
      token: tokenPhrase,
      granter_user_id: user.id,
      access_level: params.access_level,
      created_at: createdAt,
      expires_at: expiresAt,
      is_used: false,
    };

    try {
      await db.accessTokens.create(accessTokenData);
      // Attempting to match CallToolResult by providing structuredContent
      return {
        structuredContent: { 
          token_phrase: tokenPhrase,
          access_level: params.access_level,
          expires_at: expiresAt.toISOString(),
          message: `Access token generated. Share '${tokenPhrase}' to grant ${params.access_level} access for ${params.expiration_hours} hours.`
        }
        // Optionally, include a simple text message in `content` if also desired/supported for display
        // content: [{ type: "text", text: `Token created: ${tokenPhrase}` }]
      };
    } catch (error) {
      console.error("Failed to create access token:", error);
      // Again, consider McpError for protocol-specific errors
      throw new Error("Failed to store access token in the database.");
    }
  }
};

// Function to register this tool with an McpServer instance
export function registerCreateAccessTokenTool(server: McpServer) {
  server.tool(
    createAccessTokenToolDefinition.name,
    createAccessTokenToolInputSchema.shape, // Pass the .shape of the Zod schema
    createAccessTokenToolDefinition.handler
  );
}

const useAccessTokenToolInputSchema = z.object({
  token: z.string().describe("The access token phrase"),
  granter_username: z.string().describe("Username of the person who granted access (for verification)"),
});

const useAccessTokenToolDefinition = {
  name: "use_access_token",
  description: "Use an access token to gain permissions to another user's memories",
  handler: async (params: z.infer<typeof useAccessTokenToolInputSchema>, extra: any) => {
    const { token, granter_username } = params;
    // const grantee_user_id = extra?.authenticatedUserId; // ID of the user *using* the token

    // if (!grantee_user_id) {
    //   throw new Error("Grantee user authentication failed.");
    // }

    const storedToken = await db.accessTokens.findByToken(token);

    if (!storedToken) {
      throw new Error("Access token not found.");
    }

    if (storedToken.is_used) {
      throw new Error("Access token has already been used.");
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      throw new Error("Access token has expired.");
    }

    // Verify the granter_username matches the user who actually created the token
    const granterUser = await db.users.findById(storedToken.granter_user_id);
    if (!granterUser || granterUser.username !== granter_username) {
      throw new Error("Invalid granter username for this token.");
    }

    // Mark the token as used to prevent reuse (if it's a one-time use token)
    // Depending on requirements, you might not mark it used here, or have different types of tokens.
    // For simplicity in this hackathon context, let's assume one-time use.
    // await db.accessTokens.markAsUsed(storedToken.id);
 
    // What does "establish temporary access rights" mean in practice?
    // For now, return the granted permissions.
    // The actual enforcement will happen in `retrieve_shared_memory`.
    // We could potentially set something in the user's session or a short-lived capabilities cache if the MCP host supports it.
    // Or, the client (LLM) needs to remember/pass this authorization for subsequent calls.

    return {
      structuredContent: {
        message: `Access token '${token}' successfully validated.`,
        granted_access_level: storedToken.access_level,
        granter_username: granterUser.username,
        granter_user_id: storedToken.granter_user_id,
        expires_at: storedToken.expires_at.toISOString(),
        // We might return a session-specific authorization key/assertion here
        // that `retrieve_shared_memory` could consume, instead of re-validating the token.
        // For now, this information should be sufficient for the LLM to proceed.
      }
    };
  }
};

export function registerUseAccessTokenTool(server: McpServer) {
  server.tool(
    useAccessTokenToolDefinition.name,
    useAccessTokenToolInputSchema.shape,
    useAccessTokenToolDefinition.handler
  );
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
    const { shared_by_username, query } = params;
    const requester_user_id = extra?.authenticatedUserId || "requesting_user_id_placeholder"; // ID of the user making the request

    if (!requester_user_id) {
      throw new Error("Requester user authentication failed.");
    }

    const memoryOwner = await db.users.findByUsername(shared_by_username);
    if (!memoryOwner) {
      throw new Error(`User \"${shared_by_username}\" (memory owner) not found.`);
    }

    let hasPermission = false;
    let accessLevel: "read" | "write" = "read"; // Default to read for safety

    // Step 1: Check direct AccessPermission table (as per plan.md)
    const directPermission = await db.accessPermissions.find(memoryOwner.id, requester_user_id);
    if (directPermission) {
      if (directPermission.access_level === "read" || directPermission.access_level === "write") {
        hasPermission = true;
        accessLevel = directPermission.access_level;
        console.log(`Access granted via direct permission: ${accessLevel}`);
      }
    }

    // Step 2: If no direct permission, check for a valid, recently used token (conceptual)
    // This part is more complex as it relies on the state from `use_access_token`.
    // For this iteration, we'll assume the LLM/client would pass a validated token assertion or specific IDs if this flow is chosen.
    // The `plan.md` conversational flow implies the LLM manages this context.
    // If an `access_token` was an *input* to this tool, we would validate it here like in `use_access_token`.
    // Let's assume for now that if directPermission is not found, we check if the `extra` context has authorization info.
    if (!hasPermission && extra?.granted_access_to === memoryOwner.id && extra?.granted_by_token) {
        if (extra.access_level === "read" || extra.access_level === "write") {
            // We would also need to check token expiration if this info came from a token.
            console.log("Access potentially granted via token context (from LLM state)", extra.access_level);
            // This is a simplified check. A real implementation would need robust token validation or session management.
            hasPermission = true; // Assuming extra context is trusted and fresh.
            accessLevel = extra.access_level;
        }
    }

    if (!hasPermission) {
      throw new Error(`You do not have permission to access memories shared by \"${shared_by_username}\".`);
    }

    // If write access is granted, it implies read access for searching.
    const searchAccessLevel = accessLevel; // Could be "read" or "write"

    const memories = await db.memories.search(memoryOwner.id, query, searchAccessLevel);

    return {
      structuredContent: {
        shared_by_username: shared_by_username,
        query: query,
        retrieved_memories: memories,
        access_level_used: searchAccessLevel,
        count: memories.length,
        message: memories.length > 0 ? `Found ${memories.length} shared memories.` : "No shared memories found matching your query."
      }
    };
  }
};

export function registerRetrieveSharedMemoryTool(server: McpServer) {
  server.tool(
    retrieveSharedMemoryToolDefinition.name,
    retrieveSharedMemoryInputSchema.shape,
    retrieveSharedMemoryToolDefinition.handler
  );
} 