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
exports.registerSaveMemoryTool = exports.SaveMemoryOutputPayloadSchema = exports.SaveMemoryOutputSchema = exports.SaveMemoryInputSchema = exports.saveMemoryDescription = exports.saveMemoryName = void 0;
const zod_1 = require("zod");
// Removed problematic import: import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
const models_js_1 = require("../db/models.js");
const models_js_2 = require("../db/models.js"); // Import default user ID
const uuid_1 = require("uuid");
// Name and Description
exports.saveMemoryName = "save_memory";
exports.saveMemoryDescription = "Save a personal memory for later retrieval by the user.";
// Input Schema
exports.SaveMemoryInputSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, { message: "Memory content cannot be empty. Please provide some text for the memory." }),
});
// Output Schema - for documentation and potential validation, though server.tool() might not use it directly
exports.SaveMemoryOutputSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    memoryId: zod_1.z.string().uuid().optional(),
    message: zod_1.z.string(), // Made message non-optional for clearer feedback
});
// This schema now describes the object that will go *inside* structuredContent
exports.SaveMemoryOutputPayloadSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    memoryId: zod_1.z.string().uuid().optional(),
    message: zod_1.z.string(),
});
// Remove old HandlerContext, use official types for the handler context
// export interface HandlerContext { ... }
// Re-defining internal handler to be called by the MCP tool handler
function internalSaveMemoryHandler(input, userIdToUse // Now expects a definite userId
) {
    return __awaiter(this, void 0, void 0, function* () {
        const memoryId = (0, uuid_1.v4)();
        const currentTime = new Date().toISOString();
        const db = (0, models_js_1.getDb)();
        try {
            yield db.run('INSERT INTO Memory (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', memoryId, userIdToUse, input.content, currentTime, currentTime);
            const message = `Memory saved successfully. ID: ${memoryId} for user ${userIdToUse}`;
            return {
                content: [{ type: 'text', text: message }]
            };
        }
        catch (error) {
            console.error("Error saving memory to SQLite:", error);
            const message = `Failed to save memory for user ${userIdToUse}: ${error.message || 'Unknown error'}`;
            return {
                content: [{ type: 'text', text: message }]
            };
        }
    });
}
// MCP Tool Definition
const saveMemoryToolDefinition = {
    name: exports.saveMemoryName,
    description: exports.saveMemoryDescription,
    inputSchema: exports.SaveMemoryInputSchema.shape,
    handler: (params, extra) => __awaiter(void 0, void 0, void 0, function* () {
        const authenticatedUserId = extra === null || extra === void 0 ? void 0 : extra.authenticatedUserId;
        // Fallback to DEFAULT_TEST_USER_ID if no user in context
        const userIdToUse = authenticatedUserId || models_js_2.DEFAULT_TEST_USER_ID;
        if (!authenticatedUserId) {
            console.warn(`save_memory: authenticatedUserId not found in 'extra' context. Using default: ${models_js_2.DEFAULT_TEST_USER_ID}`);
        }
        return internalSaveMemoryHandler(params, userIdToUse);
    })
};
// Exported registration function
function registerSaveMemoryTool(server) {
    server.tool(saveMemoryToolDefinition.name, saveMemoryToolDefinition.inputSchema, saveMemoryToolDefinition.handler);
    console.log(`Tool registered: ${saveMemoryToolDefinition.name}`);
}
exports.registerSaveMemoryTool = registerSaveMemoryTool;
// Original saveMemoryHandler and other exports are removed or integrated above
// to avoid conflicts and streamline for MCP registration. 
