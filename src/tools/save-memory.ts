import { z } from 'zod';
// Removed problematic import: import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { getDb } from '@src/db/models';
import { v4 as uuidv4 } from 'uuid';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

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

// Handler function
export async function saveMemoryHandler(
  input: z.infer<typeof SaveMemoryInputSchema>,
  context: any, // Temporarily set to any to simplify type checking at call site
  db: any  // Added db parameter explicitly to match how it's called
): Promise<SaveMemoryToolResult> {
  // Note: we'll use the passed db instead of getDb()
  
  // How to get the Express request object (and req.user) from RequestHandlerExtra?
  // We need to inspect the type of RequestHandlerExtra or assume it has a similar structure.
  // For now, let's assume it might have `rawRequest` or a similar field that holds the original Express request.
  // This is a common pattern. If not, this part will need adjustment.
  // @ts-ignore - temporarily ignore until we know the structure of RequestHandlerExtra
  const user = context?.user || context.req?.user || context.rawRequest?.user; // Keep trying to find user

  if (!user || !user.id) {
    // @ts-ignore
    console.error('User not authenticated or user ID missing. Context keys:', context ? Object.keys(context) : 'null context');
    return {
      structuredContent: {
        success: false,
        message: "User not authenticated. Cannot save memory. Please ensure you are logged in.",
      }
    };
  }

  const memoryId = uuidv4();
  const currentTime = new Date().toISOString();

  try {
    // Use passed db or fallback to getDb()
    const dbToUse = db || getDb();
    await dbToUse.run(
      'INSERT INTO Memory (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      memoryId,
      user.id,
      input.content,
      currentTime,
      currentTime
    );

    // TODO: Add vector embedding generation and storage in ChromaDB here
    // console.log(`Memory saved for user ${user.id} with ID ${memoryId}. TODO: ChromaDB integration`);

    return {
      structuredContent: {
        success: true,
        memoryId: memoryId,
        message: "Memory saved successfully.",
      },
      content: [{ 
        type: 'text' as const, 
        text: "Memory saved successfully."
      } as TextContent] // Optional convenience text
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