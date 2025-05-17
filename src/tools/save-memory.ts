import { z } from 'zod';
// Removed problematic import: import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { getDb } from '../db/models.js';
import { DEFAULT_TEST_USER_ID } from '../db/models.js'; // Import default user ID
import { v4 as uuidv4 } from 'uuid';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; // For McpServer type

// Name and Description
export const saveMemoryName = "save_memory";
export const saveMemoryDescription = 
  "Saves a piece of text content as a personal memory for you (the authenticated user). " +
  "Use this tool when you want to remember a specific fact, note, or piece of information for later personal recall. " +
  "The memory will be associated with your user identity.";

// Input Schema
export const SaveMemoryInputSchema = z.object({
  content: z.string().min(1, { message: "Memory content cannot be empty. Please provide the text you want to remember." })
    .describe("The textual content of the memory you want to save."),
});

// Output Schema - for documentation and potential validation, though server.tool() might not use it directly
export const SaveMemoryOutputSchema = z.object({
  success: z.boolean(),
  memoryId: z.string().uuid().optional(),
  message: z.string(), // Made message non-optional for clearer feedback
});

// This schema now describes the object that will go *inside* structuredContent
export const SaveMemoryOutputPayloadSchema = z.object({
  success: z.boolean(),
  memoryId: z.string().uuid().optional(),
  message: z.string(),
});

// Define content types
interface TextContent {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

// Define the overall CallToolResult structure for this tool
// The actual `CallToolResult` type from SDK might be more complex or generic.
// We aim for our return to be assignable to it.
export type SaveMemoryToolResult = CallToolResult;

// Remove old HandlerContext, use official types for the handler context
// export interface HandlerContext { ... }

// Re-defining internal handler to be called by the MCP tool handler
async function internalSaveMemoryHandler(
  input: z.infer<typeof SaveMemoryInputSchema>,
  userIdToUse: string // Now expects a definite userId
): Promise<CallToolResult> {
  const memoryId = uuidv4();
  const currentTime = new Date().toISOString();
  const db = getDb();

  try {
    await db.run(
      'INSERT INTO Memory (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      memoryId, userIdToUse, input.content, currentTime, currentTime
    );
    
    const message = `Memory saved successfully. ID: ${memoryId} for user ${userIdToUse}`;
    return {
      content: [{ type: 'text' as const, text: message }]
    };
  } catch (error: any) {
    console.error("Error saving memory to SQLite:", error);
    const message = `Failed to save memory for user ${userIdToUse}: ${error.message || 'Unknown error'}`;
    return {
      content: [{ type: 'text' as const, text: message }]
    };
  }
}

// MCP Tool Definition
const saveMemoryToolDefinition = {
  name: saveMemoryName,
  description: saveMemoryDescription,
  inputSchema: SaveMemoryInputSchema.shape,
  handler: async (params: z.infer<typeof SaveMemoryInputSchema>, extra: any): Promise<CallToolResult> => {
    const authenticatedUserId = extra?.authenticatedUserId;
    const userIdToUse = authenticatedUserId || DEFAULT_TEST_USER_ID; 

    let messagePrefix = "";
    if (!authenticatedUserId) {
        messagePrefix = `(No authenticated user found, saving for default user '${DEFAULT_TEST_USER_ID}'). `;
        console.warn(`save_memory: authenticatedUserId not found in 'extra' context. Using default: ${DEFAULT_TEST_USER_ID}`);
    }
    
    // Call the internal handler which already formats detailed success/error messages
    const result = await internalSaveMemoryHandler(params, userIdToUse);
    
    // Prepend context message if necessary
    if (result.content && result.content.length > 0 && typeof result.content[0].text === 'string') {
        result.content[0].text = messagePrefix + result.content[0].text;
    }
    return result;
  }
};

// Exported registration function
export function registerSaveMemoryTool(server: McpServer) {
  server.tool(
    saveMemoryToolDefinition.name,
    saveMemoryToolDefinition.inputSchema,
    saveMemoryToolDefinition.handler
  );
  console.log(`Tool registered: ${saveMemoryToolDefinition.name}`);
}

// Original saveMemoryHandler and other exports are removed or integrated above
// to avoid conflicts and streamline for MCP registration. 