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
exports.registerRetrievePersonalMemoryTool = exports.RetrievePersonalMemoryInputSchema = exports.retrievePersonalMemoryDescription = exports.retrievePersonalMemoryName = void 0;
const zod_1 = require("zod");
const models_js_1 = require("../db/models.js"); // Use relative path
const models_js_2 = require("../db/models.js"); // Import default user ID
exports.retrievePersonalMemoryName = "retrieve_personal_memory";
exports.retrievePersonalMemoryDescription = "Searches and retrieves your own previously saved personal memories based on a query. " +
    "Use this when you need to recall information you've asked to be remembered. " +
    "Memories are specific to you (the authenticated user).";
exports.RetrievePersonalMemoryInputSchema = zod_1.z.object({
    query: zod_1.z.string().min(1, "Search query cannot be empty.")
        .describe("The search query or keywords to find your relevant personal memories. Be as specific as possible for better results."),
});
// Internal handler logic using actual DB operations
function internalRetrievePersonalMemoryHandler(input, userIdToUse // Now expects a definite userId
) {
    return __awaiter(this, void 0, void 0, function* () {
        const { query } = input;
        const db = (0, models_js_1.getDb)();
        try {
            const memories = yield db.all(`SELECT id, content, created_at FROM Memory WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT 10`, userIdToUse, `%${query}%`);
            let message;
            if (!memories || memories.length === 0) {
                message = `No memories found for user ${userIdToUse} matching query '${query}'.`;
            }
            else {
                const memoriesText = memories.map((mem) => `  - ID: ${mem.id}, Content: \"${mem.content}\", Recalled from: ${new Date(mem.created_at).toISOString().split('T')[0]}`).join("\n");
                message = `Found ${memories.length} memories for user ${userIdToUse} matching '${query}':\n${memoriesText}`;
            }
            return {
                content: [{ type: "text", text: message }]
            };
        }
        catch (error) {
            console.error("Error in internalRetrievePersonalMemoryHandler:", error);
            const message = `An error occurred while retrieving memories for user ${userIdToUse}: ${error.message}`;
            return {
                content: [{ type: "text", text: message }]
            };
        }
    });
}
// MCP Tool Definition
const retrievePersonalMemoryToolDefinition = {
    name: exports.retrievePersonalMemoryName,
    description: exports.retrievePersonalMemoryDescription,
    inputSchema: exports.RetrievePersonalMemoryInputSchema.shape,
    handler: (params, extra) => __awaiter(void 0, void 0, void 0, function* () {
        const authenticatedUserId = extra === null || extra === void 0 ? void 0 : extra.authenticatedUserId;
        const userIdToUse = authenticatedUserId || models_js_2.DEFAULT_TEST_USER_ID;
        let messagePrefix = "";
        if (!authenticatedUserId) {
            messagePrefix = `(No authenticated user found, retrieving for default user '${models_js_2.DEFAULT_TEST_USER_ID}'). `;
            console.warn(`retrieve_personal_memory: authenticatedUserId not found in 'extra' context. Using default: ${models_js_2.DEFAULT_TEST_USER_ID}`);
        }
        const result = yield internalRetrievePersonalMemoryHandler(params, userIdToUse);
        if (result.content && result.content.length > 0 && typeof result.content[0].text === 'string') {
            result.content[0].text = messagePrefix + result.content[0].text;
        }
        return result;
    })
};
function registerRetrievePersonalMemoryTool(server) {
    server.tool(retrievePersonalMemoryToolDefinition.name, retrievePersonalMemoryToolDefinition.inputSchema, retrievePersonalMemoryToolDefinition.handler);
    console.log(`Tool registered: ${retrievePersonalMemoryToolDefinition.name}`);
}
exports.registerRetrievePersonalMemoryTool = registerRetrievePersonalMemoryTool;
