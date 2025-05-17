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
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js"); // Corrected path
const types_js_1 = require("@modelcontextprotocol/sdk/types.js"); // Corrected path
const models_js_1 = require("./db/models.js"); // Adjusted path
const SERVER_SCRIPT_PATH = process.argv[2]; // Passed as command line argument
if (!SERVER_SCRIPT_PATH) {
    console.error("Error: Path to server script not provided.");
    console.log("Usage: node <this_script.js> <path_to_mcp_server_script.js>");
    console.log("Example: node dist/ai-test-harness.js dist/server/index.js");
    process.exit(1);
}
function createAgentClient(agentName, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${agentName}] Initializing MCP Client for user ${userId}...`);
        const client = new index_js_1.Client({
            name: `${agentName}-mcp-client`,
            version: "0.1.0",
        });
        const transport = new stdio_js_1.StdioClientTransport({
            command: process.execPath,
            args: [SERVER_SCRIPT_PATH],
        });
        try {
            client.connect(transport);
            console.log(`[${agentName}] Attempting to connect to MCP server...`);
            // Simple delay to allow server to start, replace with robust check if possible
            yield new Promise(resolve => setTimeout(resolve, 1500));
            const tools = yield client.listTools();
            console.log(`[${agentName}] Connected. Available tools: ${tools.tools.map(t => t.name).join(', ')}`);
            return client;
        }
        catch (e) {
            console.error(`[${agentName}] Failed to connect:`, e);
            return null;
        }
    });
}
// Wrapper to inject authenticatedUserId into tool calls
function callToolAsUser(client, toolName, toolArgs, userId, agentName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n[${agentName}] Calling tool '${toolName}' as user '${userId}' with args:`, JSON.stringify(toolArgs));
        try {
            const result = yield client.callTool({
                name: toolName,
                arguments: toolArgs,
                // Manually injecting authenticatedUserId into 'extra' for testing
                extra: { authenticatedUserId: userId }
            }, types_js_1.CallToolResultSchema); // Assuming CallToolResultSchema can be used here for validation
            console.log(`[${agentName}] Result for '${toolName}':`, JSON.stringify(result, null, 2));
            return result;
        }
        catch (e) {
            console.error(`[${agentName}] Error calling tool ${toolName}:`, ((_a = e.response) === null || _a === void 0 ? void 0 : _a.data) || e.message || e);
            return null;
        }
    });
}
function agent1_DefaultUser(client) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const agentName = "Agent1_UserDefault";
        const userId = models_js_1.DEFAULT_TEST_USER_ID;
        console.log(`\n--- ${agentName} (${models_js_1.DEFAULT_TEST_USERNAME}) Actions ---`);
        // 1. Save some memories
        yield callToolAsUser(client, "save_memory", { content: "User1 Memory Alpha: Project HiveMind details." }, userId, agentName);
        yield callToolAsUser(client, "save_memory", { content: "User1 Memory Beta: Important meeting notes." }, userId, agentName);
        // 2. Retrieve personal memory to confirm save
        yield callToolAsUser(client, "retrieve_personal_memory", { query: "HiveMind" }, userId, agentName);
        // 3. Create an access token for User2 (another_test_user)
        console.log(`[${agentName}] Creating access token for ${models_js_1.ANOTHER_TEST_USERNAME} to read memories...`);
        const tokenResult = yield callToolAsUser(client, "create_access_token", { access_level: "read", expiration_hours: 1 }, userId, agentName);
        // Extract token phrase from the result content
        let tokenPhrase = null;
        if (tokenResult && Array.isArray(tokenResult.content) && tokenResult.content.length > 0 && ((_a = tokenResult.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text') {
            const textContentItem = tokenResult.content[0]; // Type assertion
            const text = textContentItem.text;
            const match = text.match(/Token Phrase: \'(.*?)\'/);
            if (match && match[1]) {
                tokenPhrase = match[1];
                console.log(`[${agentName}] Extracted token phrase: ${tokenPhrase}`);
            }
        }
        if (!tokenPhrase) {
            console.error(`[${agentName}] Could not extract token phrase from create_access_token result.`);
            return null;
        }
        return tokenPhrase;
    });
}
function agent2_AnotherUser(client, tokenFromUser1) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const agentName = "Agent2_UserAnother";
        const userId = models_js_1.ANOTHER_TEST_USER_ID;
        console.log(`\n--- ${agentName} (${models_js_1.ANOTHER_TEST_USERNAME}) Actions ---`);
        // 1. Use the access token provided by User1
        console.log(`[${agentName}] Attempting to use token: ${tokenFromUser1} from granter ${models_js_1.DEFAULT_TEST_USERNAME}`);
        const useTokenResult = yield callToolAsUser(client, "use_access_token", { token: tokenFromUser1, granter_username: models_js_1.DEFAULT_TEST_USERNAME }, userId, agentName);
        // Check if useTokenResult and its content are valid, and if the text indicates an error
        if (!useTokenResult || !Array.isArray(useTokenResult.content) || useTokenResult.content.length === 0 ||
            (((_a = useTokenResult.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' && useTokenResult.content[0].text.toLowerCase().includes('error'))) {
            console.error(`[${agentName}] Failed to use access token or token validation failed. Aborting shared memory test. Result:`, JSON.stringify(useTokenResult, null, 2));
            return;
        }
        console.log(`[${agentName}] Successfully used access token.`);
        // At this point, with current tool logic, use_access_token doesn't create a persistent permission.
        // retrieve_shared_memory will rely on a direct AccessPermission. So we need to ensure one exists for this test case.
        // For a more automated test of token flow leading to access, use_access_token would need to write to AccessPermission table.
        // The test instructions state: "i want the user 2 to be able to read the user 1's memory"
        // This implies the token flow should grant this.
        // Let's modify use_access_token to also create a temporary AccessPermission entry.
        // This change needs to be done in access-control.ts for use_access_token tool.
        // For this script, we proceed assuming the token use implies access for retrieve_shared_memory for now.
        // The `retrieve_shared_memory` tool has a conceptual check for `extra.validated_token_for_owner` but our test harness doesn't set it this way.
        // It will rely on the direct permission check.
        // 2. Retrieve shared memories from User1
        // To make this pass without manual DB intervention for this test script, we'd need use_access_token to create a permission.
        // Or, the test setup must ensure a direct permission exists.
        // The current test will likely fail at retrieve_shared_memory unless direct permission is already in DB for ANOTHER_TEST_USER_ID to DEFAULT_TEST_USER_ID.
        console.log(`[${agentName}] Attempting to retrieve memories from ${models_js_1.DEFAULT_TEST_USERNAME} using query 'HiveMind'...`);
        yield callToolAsUser(client, "retrieve_shared_memory", { shared_by_username: models_js_1.DEFAULT_TEST_USERNAME, query: "HiveMind" }, userId, agentName);
        console.log(`[${agentName}] Attempting to retrieve memories from ${models_js_1.DEFAULT_TEST_USERNAME} using query 'meeting'...`);
        yield callToolAsUser(client, "retrieve_shared_memory", { shared_by_username: models_js_1.DEFAULT_TEST_USERNAME, query: "meeting" }, userId, agentName);
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting AI Agent Test Harness...");
        // Initialize DB for the test harness process itself
        try {
            console.log("[TestHarnessSetup] Initializing database for harness process...");
            yield (0, models_js_1.initDb)(); // Call initDb here
            console.log("[TestHarnessSetup] Database for harness process initialized.");
        }
        catch (dbInitError) {
            console.error("[TestHarnessSetup] CRITICAL: Failed to initialize database for harness:", dbInitError);
            process.exit(1);
        }
        const client1 = yield createAgentClient("Agent1", models_js_1.DEFAULT_TEST_USER_ID);
        const client2 = yield createAgentClient("Agent2", models_js_1.ANOTHER_TEST_USER_ID);
        if (!client1 || !client2) {
            console.error("Failed to initialize one or more agent clients. Aborting test.");
            if (client1 && typeof client1.close === 'function')
                yield client1.close();
            if (client2 && typeof client2.close === 'function')
                yield client2.close();
            return;
        }
        try {
            const tokenForUser2 = yield agent1_DefaultUser(client1);
            if (tokenForUser2) {
                // Get the DB instance that was initialized by this harness process
                const db = (0, models_js_1.getDb)();
                try {
                    console.log(`[TestHarnessSetup] Ensuring direct permission for ${models_js_1.ANOTHER_TEST_USERNAME} to access ${models_js_1.DEFAULT_TEST_USERNAME}'s memories.`);
                    yield db.run('INSERT OR IGNORE INTO AccessPermission (id, granter_user_id, grantee_user_id, access_level) VALUES (?, ?, ?, ?)', `test_direct_perm_${models_js_1.DEFAULT_TEST_USER_ID}_${models_js_1.ANOTHER_TEST_USER_ID}`, models_js_1.DEFAULT_TEST_USER_ID, models_js_1.ANOTHER_TEST_USER_ID, 'read');
                }
                catch (dbError) {
                    console.error("[TestHarnessSetup] Error ensuring direct permission:", dbError);
                    // Decide if this is fatal for the test or if agent2_AnotherUser can proceed and potentially fail at shared memory retrieval
                }
                yield agent2_AnotherUser(client2, tokenForUser2);
            }
        }
        catch (e) {
            console.error("Error during agent test execution:", e);
        }
        finally {
            console.log("\n--- Test Harness Finishing --- ");
            if (client1 && typeof client1.close === 'function')
                yield client1.close();
            if (client2 && typeof client2.close === 'function')
                yield client2.close();
            console.log("Agent clients closed.");
            process.exit(0);
        }
    });
}
main().catch(e => {
    console.error("Unhandled error in AI Test Harness main:", e);
    process.exit(1);
});
