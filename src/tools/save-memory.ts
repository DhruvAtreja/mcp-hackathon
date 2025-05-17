import { z } from 'zod';
// Removed problematic import: import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { getDb } from '@src/db/models';
import { v4 as uuidv4 } from 'uuid';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; // For McpServer type

// Name and Description
export const saveMemoryName = "save_memory";
export const saveMemoryDescription = "Save a personal memory for later retrieval by the user.";

// Input Schema
export const SaveMemoryInputSchema = z.object({
  content: z.string().min(1, { message: "Memory content cannot be empty. Please provide some text for the memory." }),
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
  userId: string | undefined // Changed from context to explicit userId
): Promise<CallToolResult> {
  if (!userId) {
    console.error('User not authenticated or user ID missing.');
    return {
      structuredContent: {
        success: false,
        message: "User not authenticated. Cannot save memory.",
      }
    };
  }

  const memoryId = uuidv4();
  const currentTime = new Date().toISOString();
  const db = getDb(); // Get DB instance here

  try {
    await db.run(
      'INSERT INTO Memory (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      memoryId,
      userId,
      input.content,
      currentTime,
      currentTime
    );

    return {
      structuredContent: {
        success: true,
        memoryId: memoryId,
        message: "Memory saved successfully.",
      },
      content: [{ 
        type: 'text' as const, 
        text: "Memory saved successfully."
      }] 
    };
  } catch (error: any) {
    console.error("Error saving memory to SQLite:", error);
    return {
      structuredContent: {
        success: false,
        message: `Failed to save memory: ${error.message || 'Unknown error'}`,
      }
    };
  }
}

// MCP Tool Definition
const saveMemoryToolDefinition = {
  name: saveMemoryName,
  description: saveMemoryDescription,
  inputSchema: SaveMemoryInputSchema.shape, // Pass .shape for McpServer.tool
  handler: async (params: z.infer<typeof SaveMemoryInputSchema>, extra: any): Promise<CallToolResult> => {
    const userId = extra?.authenticatedUserId; // Get userId from MCP context
    // In a real app, ensure `authenticatedUserId` is consistently populated by your auth setup for MCP.
    // For now, we can use a placeholder if it's missing for testing, or throw an error.
    const effectiveUserId = userId || "mock_user_id_for_save_memory"; // Placeholder if not in extra
    if (!userId) {
        console.warn(`save_memory: authenticatedUserId not found in 'extra' context. Using placeholder: ${effectiveUserId}`);
    }
    return internalSaveMemoryHandler(params, effectiveUserId);
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