import { z } from 'zod';
import { getDb } from '../db/models.js'; // Use relative path
import { DEFAULT_TEST_USER_ID } from '../db/models.js'; // Import default user ID
// Op might not be needed if using raw SQL directly with db.all or db.run
// import { Op } from 'sequelize'; 
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const retrievePersonalMemoryName = "retrieve_personal_memory";
export const retrievePersonalMemoryDescription = 
  "Searches and retrieves your own previously saved personal memories based on a query. " +
  "Use this when you need to recall information you've asked to be remembered. " +
  "Memories are specific to you (the authenticated user).";

export const RetrievePersonalMemoryInputSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty.")
    .describe("The search query or keywords to find your relevant personal memories. Be as specific as possible for better results."),
});

// Internal handler logic using actual DB operations
async function internalRetrievePersonalMemoryHandler(
  input: z.infer<typeof RetrievePersonalMemoryInputSchema>,
  userIdToUse: string // Now expects a definite userId
): Promise<CallToolResult> {
  const { query } = input;
  const db = getDb();

  try {
    const memories = await db.all(
      `SELECT id, content, created_at FROM Memory WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT 10`,
      userIdToUse,
      `%${query}%`
    );

    let message: string;
    if (!memories || memories.length === 0) {
      message = `No memories found for user ${userIdToUse} matching query '${query}'.`;
    } else {
      const memoriesText = memories.map((mem: any) => 
        `  - ID: ${mem.id}, Content: \"${mem.content}\", Recalled from: ${new Date(mem.created_at).toISOString().split('T')[0]}`
      ).join("\n");
      message = `Found ${memories.length} memories for user ${userIdToUse} matching '${query}':\n${memoriesText}`;
    }
    return {
      content: [{ type: "text" as const, text: message }]
    };
  } catch (error: any) {
    console.error("Error in internalRetrievePersonalMemoryHandler:", error);
    const message = `An error occurred while retrieving memories for user ${userIdToUse}: ${error.message}`;
    return {
      content: [{ type: "text" as const, text: message }]
    };
  }
}

// MCP Tool Definition
const retrievePersonalMemoryToolDefinition = {
  name: retrievePersonalMemoryName,
  description: retrievePersonalMemoryDescription,
  inputSchema: RetrievePersonalMemoryInputSchema.shape,
  handler: async (params: z.infer<typeof RetrievePersonalMemoryInputSchema>, extra: any): Promise<CallToolResult> => {
    const authenticatedUserId = extra?.authenticatedUserId;
    const userIdToUse = authenticatedUserId || DEFAULT_TEST_USER_ID; 
    
    let messagePrefix = "";
    if (!authenticatedUserId) {
        messagePrefix = `(No authenticated user found, retrieving for default user '${DEFAULT_TEST_USER_ID}'). `;
        console.warn(`retrieve_personal_memory: authenticatedUserId not found in 'extra' context. Using default: ${DEFAULT_TEST_USER_ID}`);
    }
    
    const result = await internalRetrievePersonalMemoryHandler(params, userIdToUse);
    
    if (result.content && result.content.length > 0 && typeof result.content[0].text === 'string') {
        result.content[0].text = messagePrefix + result.content[0].text;
    }
    return result;
  }
};

export function registerRetrievePersonalMemoryTool(server: McpServer) {
  server.tool(
    retrievePersonalMemoryToolDefinition.name,
    retrievePersonalMemoryToolDefinition.inputSchema,
    retrievePersonalMemoryToolDefinition.handler
  );
  console.log(`Tool registered: ${retrievePersonalMemoryToolDefinition.name}`);
} 