import { z } from 'zod';
import { getDb } from '@src/db/models'; // For DB instance
import { Op } from 'sequelize'; // Assuming Op is still needed if not using raw SQL
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const retrievePersonalMemoryName = "retrieve_personal_memory";
export const retrievePersonalMemoryDescription = "Retrieve your own memories based on a search query.";

export const RetrievePersonalMemoryInputSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty.")
});

// Internal handler logic
async function internalRetrievePersonalMemoryHandler(
  input: z.infer<typeof RetrievePersonalMemoryInputSchema>,
  userId: string | undefined
): Promise<CallToolResult> {
  if (!userId) {
    return {
      structuredContent: {},
      content: [{ type: "text" as const, text: "Error: User not authenticated." }]
    };
  }

  const { query } = input;
  const db = getDb(); // Get DB instance

  try {
    // Using raw SQL with sqlite instead of Sequelize model syntax for this example
    // as the original `db.models.Memory` might not be set up in this context.
    // This also simplifies dependencies for this specific tool file.
    const memories = await db.all(
      `SELECT id, content, createdAt FROM Memory WHERE user_id = ? AND content LIKE ? ORDER BY createdAt DESC LIMIT 10`,
      userId,
      `%${query}%`
    );

    if (!memories || memories.length === 0) {
      return {
        structuredContent: {},
        content: [{ type: "text" as const, text: "No memories found matching your query." }]
      };
    }

    return {
      structuredContent: { retrieved_count: memories.length }, // Example structured content
      content: memories.map((mem: any) => ({
        type: "text" as const,
        text: `Memory (ID: ${mem.id}): \"${mem.content}\" (Recalled from: ${new Date(mem.createdAt).toISOString().split('T')[0]})`
      }))
    };
  } catch (error: any) {
    console.error("Error in internalRetrievePersonalMemoryHandler:", error);
    return {
      structuredContent: { error: error.message },
      content: [{ type: "text" as const, text: `An error occurred: ${error.message}` }]
    };
  }
}

// MCP Tool Definition
const retrievePersonalMemoryToolDefinition = {
  name: retrievePersonalMemoryName,
  description: retrievePersonalMemoryDescription,
  inputSchema: RetrievePersonalMemoryInputSchema.shape, // Pass .shape for McpServer.tool
  handler: async (params: z.infer<typeof RetrievePersonalMemoryInputSchema>, extra: any): Promise<CallToolResult> => {
    const userId = extra?.authenticatedUserId;
    const effectiveUserId = userId || "mock_user_id_for_retrieve"; // Placeholder
     if (!userId) {
        console.warn(`retrieve_personal_memory: authenticatedUserId not found in 'extra' context. Using placeholder: ${effectiveUserId}`);
    }
    return internalRetrievePersonalMemoryHandler(params, effectiveUserId);
  }
};

// Exported registration function
export function registerRetrievePersonalMemoryTool(server: McpServer) {
  server.tool(
    retrievePersonalMemoryToolDefinition.name,
    retrievePersonalMemoryToolDefinition.inputSchema,
    retrievePersonalMemoryToolDefinition.handler
  );
  console.log(`Tool registered: ${retrievePersonalMemoryToolDefinition.name}`);
} 