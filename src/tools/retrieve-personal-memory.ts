import { z } from 'zod';
import { AuthenticatedRequest } from '@src/server/auth';
import { Sequelize, Op } from 'sequelize'; // Assuming Sequelize and Op for LIKE query
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'; // Import CallToolResult
// Assuming Memory model type will be available via db.models.Memory

export const retrievePersonalMemoryName = "retrieve_personal_memory";
export const retrievePersonalMemoryDescription = "Retrieve your own memories based on a search query.";

export const RetrievePersonalMemoryInputSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty."),
});

export type RetrievePersonalMemoryInput = z.infer<typeof RetrievePersonalMemoryInputSchema>;

// Define a content item type that matches what CallToolResult expects
interface TextContentItem {
  type: "text";
  text: string;
  [key: string]: unknown;
}

// Define a return type that is compatible with CallToolResult
export type RetrieveMemoryToolResult = CallToolResult;

export async function retrievePersonalMemoryHandler(
  input: RetrievePersonalMemoryInput,
  req: AuthenticatedRequest,
  db: Sequelize // db is the Sequelize instance
): Promise<RetrieveMemoryToolResult> {
  const userId = req.user?.id;

  if (!userId) {
    // This case should ideally be prevented by the authMiddleware.
    return {
      structuredContent: {},
      content: [{
        type: "text" as const,
        text: "Error: User not authenticated. Cannot retrieve memories."
      }]
    };
  }

  const { query } = input;

  try {
    // Access the Memory model through the db instance
    const MemoryModel = db.models.Memory;
    if (!MemoryModel) {
        console.error("Memory model is not defined on db.models");
        return {
            structuredContent: {},
            content: [{
              type: "text" as const,
              text: "Error: Server configuration issue, Memory model not found."
            }]
        };
    }

    const memories = await MemoryModel.findAll({
      where: {
        user_id: userId,
        content: {
          [Op.like]: `%${query}%`, // Case-insensitive search for most SQL dialects
        },
      },
      order: [['createdAt', 'DESC']], // Show most recent relevant memories first
      limit: 10, // Limit the number of results to keep responses manageable
    });

    if (!memories || memories.length === 0) {
      return {
        structuredContent: {},
        content: [{
          type: "text" as const,
          text: "No memories found matching your query."
        }]
      };
    }

    return {
      structuredContent: {},
      content: memories.map((mem: any) => ({
        type: "text" as const,
        text: `Memory (ID: ${mem.id}): "${mem.content}" (Recalled from: ${mem.createdAt.toISOString().split('T')[0]})`
      }))
    };
  } catch (error: any) {
    console.error("Error in retrievePersonalMemoryHandler:", error);
    // Provide a generic error message to the user
    return {
      structuredContent: {},
      content: [{
        type: "text" as const,
        text: `An error occurred while retrieving memories: ${error.message}`
      }]
    };
  }
} 