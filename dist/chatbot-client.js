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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const models_js_1 = require("./db/models.js");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const readline = __importStar(require("readline"));
const process_1 = require("process");
const SERVER_SCRIPT_PATH = process.argv[2];
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!SERVER_SCRIPT_PATH) {
    console.error("Error: Path to server script not provided.");
    console.log("Usage: node <this_script.js> <path_to_mcp_server_script.js>");
    process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable not set.");
    process.exit(1);
}
const rl = readline.createInterface({ input: process_1.stdin, output: process_1.stdout });
// Promisify rl.question for async/await usage
const question = (promptText) => {
    return new Promise((resolve) => {
        rl.question(promptText, resolve);
    });
};
class ChatbotMcpClient {
    constructor() {
        this.toolsForLLM = [];
        this.currentUserId = models_js_1.DEFAULT_TEST_USER_ID;
        this.currentUsername = models_js_1.DEFAULT_TEST_USERNAME;
        this.anthropic = new sdk_1.default({ apiKey: ANTHROPIC_API_KEY });
        this.mcpClient = new index_js_1.Client({
            name: "chatbot-mcp-client",
            version: "0.1.0",
        });
        console.log("Chatbot MCP Client initialized.");
    }
    connectToServer(serverPath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.transport = new stdio_js_1.StdioClientTransport({
                command: process.execPath,
                args: [serverPath],
            });
            try {
                this.mcpClient.connect(this.transport);
                console.log("Attempting to connect to MCP server via stdio...");
                yield new Promise(resolve => setTimeout(resolve, 1500));
                const mcpTools = yield this.mcpClient.listTools();
                this.toolsForLLM = mcpTools.tools.map(tool => ({
                    name: tool.name,
                    description: tool.description || "",
                    input_schema: tool.inputSchema,
                }));
                console.log("Connected to MCP server. Available tools for LLM:", this.toolsForLLM.map(t => t.name).join(", "));
                if (this.toolsForLLM.length === 0) {
                    console.warn("Warning: No tools reported by the server, LLM will not be able to use any.");
                }
            }
            catch (e) {
                console.error("Failed to connect to MCP server or list tools:", e);
                throw e;
            }
        });
    }
    setCurrentUser() {
        return __awaiter(this, void 0, void 0, function* () {
            const answer = yield question(`Simulate as which user? (1: ${models_js_1.DEFAULT_TEST_USERNAME}, 2: ${models_js_1.ANOTHER_TEST_USERNAME}, default: 1): `);
            if (answer.trim() === '2') {
                this.currentUserId = models_js_1.ANOTHER_TEST_USER_ID;
                this.currentUsername = models_js_1.ANOTHER_TEST_USERNAME;
            }
            else {
                this.currentUserId = models_js_1.DEFAULT_TEST_USER_ID;
                this.currentUsername = models_js_1.DEFAULT_TEST_USERNAME;
            }
            console.log(`Chatting as: ${this.currentUsername} (ID: ${this.currentUserId})`);
            if (this.currentUserId === models_js_1.ANOTHER_TEST_USER_ID) {
                try {
                    yield (0, models_js_1.initDb)();
                    const db = (0, models_js_1.getDb)();
                    console.log(`[ChatbotSetup] Ensuring direct permission for ${models_js_1.ANOTHER_TEST_USERNAME} to access ${models_js_1.DEFAULT_TEST_USERNAME}'s memories.`);
                    yield db.run('INSERT OR IGNORE INTO AccessPermission (id, granter_user_id, grantee_user_id, access_level) VALUES (?, ?, ?, ?)', `chatbot_direct_perm_${models_js_1.DEFAULT_TEST_USER_ID}_${models_js_1.ANOTHER_TEST_USER_ID}`, models_js_1.DEFAULT_TEST_USER_ID, models_js_1.ANOTHER_TEST_USER_ID, 'read');
                }
                catch (dbError) {
                    console.error("[ChatbotSetup] Error ensuring direct permission:", dbError);
                }
            }
        });
    }
    processMessage(userMessage) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`\n${this.currentUsername} (You): ${userMessage}`);
            const messages = [{ role: "user", content: userMessage }];
            try {
                let response = yield this.anthropic.messages.create({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 2048,
                    messages: messages,
                    tools: this.toolsForLLM.length > 0 ? this.toolsForLLM : undefined,
                });
                while (response.stop_reason === "tool_use") {
                    const toolUses = response.content.filter((c) => c.type === "tool_use");
                    if (toolUses.length === 0) {
                        console.warn("LLM indicated tool_use but no tool_use blocks found.");
                        break;
                    }
                    messages.push({ role: "assistant", content: response.content });
                    const toolResults = [];
                    for (const toolUse of toolUses) {
                        console.log(`LLM wants to use tool: ${toolUse.name} with ID: ${toolUse.id} and args: ${JSON.stringify(toolUse.input)}`);
                        const mcpToolResult = yield this.mcpClient.callTool({
                            name: toolUse.name,
                            arguments: toolUse.input,
                            extra: { authenticatedUserId: this.currentUserId }
                        }, types_js_1.CallToolResultSchema);
                        let toolOutputText = "Error processing tool result or no content.";
                        if (mcpToolResult && Array.isArray(mcpToolResult.content) && mcpToolResult.content.length > 0 && ((_a = mcpToolResult.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text') {
                            const textContentItem = mcpToolResult.content[0];
                            toolOutputText = textContentItem.text;
                        }
                        console.log(`MCP Tool '${toolUse.name}' raw result: ${toolOutputText}`);
                        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: toolOutputText });
                    }
                    messages.push({ role: "user", content: toolResults });
                    response = yield this.anthropic.messages.create({
                        model: "claude-3-haiku-20240307",
                        max_tokens: 2048,
                        messages: messages,
                        tools: this.toolsForLLM.length > 0 ? this.toolsForLLM : undefined,
                    });
                }
                const finalResponseText = response.content
                    .filter((c) => c.type === "text")
                    .map((c) => c.text)
                    .join("\n");
                console.log(`SkyNet LLM (${this.currentUsername}'s Agent): ${finalResponseText}`);
                return finalResponseText;
            }
            catch (error) {
                console.error("Error processing message with LLM or MCP tools:", error);
                return "I encountered an error. Please try again.";
            }
        });
    }
    startChatLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setCurrentUser();
            console.log(`Starting chat. Type 'quit' or 'exit' to end.`);
            while (true) {
                const userInput = yield question("> ");
                if (userInput.toLowerCase() === "quit" || userInput.toLowerCase() === "exit") {
                    break;
                }
                if (userInput.trim() === "")
                    continue;
                yield this.processMessage(userInput);
            }
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Shutting down chatbot client...");
            if (this.mcpClient && typeof this.mcpClient.close === 'function') {
                yield this.mcpClient.close();
            }
            rl.close();
        });
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const chatbot = new ChatbotMcpClient();
        try {
            yield chatbot.connectToServer(SERVER_SCRIPT_PATH);
            yield chatbot.startChatLoop();
        }
        catch (error) {
            console.error("Critical error in chatbot main execution:", error);
        }
        finally {
            yield chatbot.cleanup();
            console.log("Chatbot client finished.");
            process.exit(0);
        }
    });
}
main().catch(e => {
    console.error("Unhandled fatal error:", e);
    process.exit(1);
});
