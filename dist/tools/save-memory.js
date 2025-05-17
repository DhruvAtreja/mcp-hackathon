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
exports.saveMemoryHandler = exports.SaveMemoryOutputPayloadSchema = exports.SaveMemoryOutputSchema = exports.SaveMemoryInputSchema = exports.saveMemoryDescription = exports.saveMemoryName = void 0;
const zod_1 = require("zod");
// Removed problematic import: import { RequestHandlerExtra, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
const models_1 = require("@src/db/models");
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
// Handler function
function saveMemoryHandler(input, context, // Temporarily set to any to simplify type checking at call site
db // Added db parameter explicitly to match how it's called
) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // Note: we'll use the passed db instead of getDb()
        // How to get the Express request object (and req.user) from RequestHandlerExtra?
        // We need to inspect the type of RequestHandlerExtra or assume it has a similar structure.
        // For now, let's assume it might have `rawRequest` or a similar field that holds the original Express request.
        // This is a common pattern. If not, this part will need adjustment.
        // @ts-ignore - temporarily ignore until we know the structure of RequestHandlerExtra
        const user = (context === null || context === void 0 ? void 0 : context.user) || ((_a = context.req) === null || _a === void 0 ? void 0 : _a.user) || ((_b = context.rawRequest) === null || _b === void 0 ? void 0 : _b.user); // Keep trying to find user
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
        const memoryId = (0, uuid_1.v4)();
        const currentTime = new Date().toISOString();
        try {
            // Use passed db or fallback to getDb()
            const dbToUse = db || (0, models_1.getDb)();
            yield dbToUse.run('INSERT INTO Memory (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', memoryId, user.id, input.content, currentTime, currentTime);
            // TODO: Add vector embedding generation and storage in ChromaDB here
            // console.log(`Memory saved for user ${user.id} with ID ${memoryId}. TODO: ChromaDB integration`);
            return {
                structuredContent: {
                    success: true,
                    memoryId: memoryId,
                    message: "Memory saved successfully.",
                },
                content: [{
                        type: 'text',
                        text: "Memory saved successfully."
                    }] // Optional convenience text
            };
        }
        catch (error) {
            console.error("Error saving memory to SQLite:", error);
            return {
                structuredContent: {
                    success: false,
                    message: `Failed to save memory: ${error.message || 'Unknown error'}`,
                }
            };
        }
    });
}
exports.saveMemoryHandler = saveMemoryHandler;
