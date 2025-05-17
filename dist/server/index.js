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
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const models_1 = require("../db/models");
// Import tool registration functions from access-control.ts
const access_control_js_1 = require("../tools/access-control.js");
const save_memory_js_1 = require("../tools/save-memory.js");
const retrieve_personal_memory_js_1 = require("../tools/retrieve-personal-memory.js");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.error("HiveMind MCP Server: Initializing database...");
        yield (0, models_1.initDb)();
        console.error("HiveMind MCP Server: Database initialized.");
        // Use console.error for server-side logging to keep stdout clean for JSON-RPC
        console.error("HiveMind MCP Server: Initializing...");
        const server = new mcp_js_1.McpServer({
            name: "hivemind-mcp-server",
            version: "0.1.0",
            capabilities: {
                tools: {}, // Declare that this server provides tools
                // resources: {}, // Future use
                // prompts: {},   // Future use
            },
        });
        console.error("HiveMind MCP Server: Registering tools...");
        // Register the access control tools
        (0, access_control_js_1.registerCreateAccessTokenTool)(server);
        (0, access_control_js_1.registerUseAccessTokenTool)(server);
        (0, access_control_js_1.registerRetrieveSharedMemoryTool)(server);
        // Register memory tools
        (0, save_memory_js_1.registerSaveMemoryTool)(server);
        (0, retrieve_personal_memory_js_1.registerRetrievePersonalMemoryTool)(server);
        // TODO: Register other tools from the plan (save_memory, retrieve_personal_memory) if/when implemented
        // e.g.:
        // import { registerSaveMemoryTool } from "../tools/save-memory.js";
        // import { registerRetrievePersonalMemoryTool } from "../tools/retrieve-personal-memory.js";
        // registerSaveMemoryTool(server); (assuming it's updated for the new McpServer API)
        // registerRetrievePersonalMemoryTool(server); (assuming it's updated)
        console.error("HiveMind MCP Server: All tools registered.");
        const transport = new stdio_js_1.StdioServerTransport();
        try {
            // Connect the server instance to the chosen transport
            yield server.connect(transport);
            console.error("HiveMind MCP Server: Connected to stdio transport. Listening for requests...");
        }
        catch (error) {
            console.error("HiveMind MCP Server: Fatal error during server connection or while running:", error);
            process.exit(1); // Exit if the server cannot start or encounters a fatal error
        }
        // The server is now running and will handle requests over stdio.
        // It will continue until the transport is closed (e.g., client disconnects).
    });
}
main().catch((error) => {
    console.error("HiveMind MCP Server: Unhandled fatal error in main execution:", error);
    process.exit(1);
});
