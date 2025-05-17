"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const readline = __importStar(require("readline"));
const process_1 = require("process");
// Helper to ask questions - using standard callback-based readline
const rl = readline.createInterface({ input: process_1.stdin, output: process_1.stdout });
// Promisify the question method
const question = (prompt) => {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
};
class SimpleMcpClient {
    constructor() {
        // Client constructor expects at least one argument with configuration
        this.client = new index_js_1.Client({
            name: "simple-mcp-client",
            version: "0.1.0", // Client version
        });
    }
    connect(serverScriptPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!serverScriptPath.endsWith(".js")) {
                    // Assuming the server is a Node.js script.
                    // Add .py check if Python servers are also to be supported.
                    throw new Error("Server script must be a .js file for this client.");
                }
                this.transport = new stdio_js_1.StdioClientTransport({
                    command: process.execPath,
                    args: [serverScriptPath],
                });
                this.client.connect(this.transport);
                console.log("Attempting to connect to MCP server via stdio...");
                // It might take a moment for the server to start and connect.
                // A robust client might have a handshake or ready check.
                // For simplicity, we'll assume it connects quickly.
                const toolsResult = yield this.client.listTools();
                console.log("\nConnected to server. Available tools:", toolsResult.tools.map(t => t.name).join(", ") || "None");
                if (toolsResult.tools.length === 0) {
                    console.warn("Warning: No tools reported by the server.");
                }
            }
            catch (e) {
                console.error("Failed to connect to MCP server:", e);
                throw e;
            }
        });
    }
    callTool(name, args) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`\nCalling tool: ${name} with args:`, JSON.stringify(args));
                const result = yield this.client.callTool({ name, arguments: args });
                console.log("Tool call result:", JSON.stringify(result, null, 2));
                return result;
            }
            catch (e) {
                console.error(`Error calling tool ${name}:`, ((_a = e.response) === null || _a === void 0 ? void 0 : _a.data) || e.message || e);
                return null;
            }
        });
    }
    interactiveLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("\nEnter 'list' to see tools.");
            console.log("Enter 'call <tool_name> <json_args>' to call a tool (e.g., call create_access_token {\"access_level\":\"read\",\"expiration_hours\":1}).");
            console.log("Enter 'quit' to exit.");
            while (true) {
                const userInput = yield question("\nMCP Client > ");
                const parts = userInput.trim().split(/\s+/);
                const command = parts[0];
                if (command === "quit") {
                    break;
                }
                else if (command === "list") {
                    const toolsResult = yield this.client.listTools();
                    console.log("Available tools:", toolsResult.tools.map(t => t.name).join(", ") || "None");
                }
                else if (command === "call") {
                    if (parts.length < 2) {
                        console.log("Usage: call <tool_name> [json_args]");
                        continue;
                    }
                    const toolName = parts[1];
                    let toolArgs = {};
                    if (parts.length > 2) {
                        const argsString = parts.slice(2).join(" ");
                        try {
                            toolArgs = JSON.parse(argsString);
                        }
                        catch (e) {
                            console.error("Invalid JSON arguments. Make sure JSON is well-formed and quoted if it contains spaces:", e);
                            continue;
                        }
                    }
                    yield this.callTool(toolName, toolArgs);
                }
                else if (userInput.trim() === "") {
                    // Do nothing on empty input
                }
                else {
                    console.log("Unknown command. Available commands: list, call, quit");
                }
            }
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.client) {
                try {
                    console.log("Closing client connection (stdio transport will terminate server process).");
                    // If the client has a close method:
                    if (typeof this.client.close === 'function') {
                        yield this.client.close();
                    }
                }
                catch (e) {
                    console.error("Error during cleanup:", e);
                }
            }
            rl.close();
        });
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.argv.length < 3) {
            console.log("Usage: node <this_script.js> <path_to_mcp_server_script.js>");
            console.log("Example: node dist/test-client.js dist/server/index.js"); // Assuming TS compiles to dist
            return;
        }
        const serverScriptPath = process.argv[2];
        const mcpClient = new SimpleMcpClient();
        try {
            yield mcpClient.connect(serverScriptPath);
            yield mcpClient.interactiveLoop();
        }
        catch (e) {
            console.error("An error occurred in the client's main execution:", e);
        }
        finally {
            yield mcpClient.cleanup();
            console.log("MCP Client finished.");
            process.exit(0); // Ensure process exits cleanly
        }
    });
}
main().catch(e => {
    console.error("Unhandled error in main:", e);
    process.exit(1);
});
// Removed String.prototype.splitArgs to simplify and avoid potential issues.
// Users will need to ensure JSON arguments are passed as a single block or correctly quoted. 
