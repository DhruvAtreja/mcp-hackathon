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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const models_1 = require("@src/db/models");
const auth_1 = require("./auth");
// Import the refactored tool components
const save_memory_1 = require("@src/tools/save-memory");
// Import the new tool components for retrieving memories
const retrieve_personal_memory_1 = require("@src/tools/retrieve-personal-memory");
// Import tool handlers here once created
const zod_1 = require("zod");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
// Health check route
app.get('/health', (req, res) => {
    res.status(200).send('Server is healthy');
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Initialize database
        const db = yield (0, models_1.initDb)();
        // Initialize MCP Server
        const mcpServer = new mcp_js_1.McpServer({
            name: "SkyNetMCPServer",
            version: "1.0.0",
            // logger: console, // Optional: for verbose logging
        });
        // Register both tools using the approach from the blog post
        mcpServer.tool("save_memory", { content: zod_1.z.string() }, ({ content }) => __awaiter(this, void 0, void 0, function* () {
            // Call the handler with our context and pass db
            try {
                const fakeRequest = { user: { id: "default-user" } };
                return yield (0, save_memory_1.saveMemoryHandler)({ content }, fakeRequest, db);
            }
            catch (err) {
                console.error("Error in save_memory tool:", err);
                return {
                    structuredContent: {},
                    content: [{ type: "text", text: `Error: ${err}` }]
                };
            }
        }));
        // Register the retrieve_personal_memory tool
        mcpServer.tool("retrieve_personal_memory", { query: zod_1.z.string() }, ({ query }) => __awaiter(this, void 0, void 0, function* () {
            // Call the handler with our context and pass db
            try {
                const fakeRequest = { user: { id: "default-user" } };
                return yield (0, retrieve_personal_memory_1.retrievePersonalMemoryHandler)({ query }, fakeRequest, db);
            }
            catch (err) {
                console.error("Error in retrieve_personal_memory tool:", err);
                return {
                    structuredContent: {},
                    content: [{ type: "text", text: `Error: ${err}` }]
                };
            }
        }));
        // For description, it might be that the McpServer constructor can take a general
        // description, or tools are expected to have self-descriptive names.
        // Or, the description might be part of an options object for server.tool if it exists.
        // For now, `saveMemoryDescription` is not directly used in this registration call.
        // Setup MCP transport
        const mcpTransport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: () => "", // Return an empty string for the session ID
            // Add any other transport-specific options here if needed
        });
        // Connect server to transport
        yield mcpServer.connect(mcpTransport);
        // Apply auth middleware and MCP handler to MCP routes
        app.all('/mcp', auth_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield mcpTransport.handleRequest(req, res, req.body);
            }
            catch (error) {
                console.error('Error handling MCP request:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        error: { code: -32603, message: 'Internal server error' },
                    });
                }
            }
        }));
        app.get('/', (req, res) => {
            res.send('SkyNet MCP Server is running!');
        });
        app.listen(PORT, () => {
            console.log(`SkyNet MCP Server listening at http://localhost:${PORT}`);
        });
    });
}
main().catch(console.error);
console.log("Relinting index.ts after save-memory.ts handler return type change.");
