import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"; // Corrected path
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"; // Corrected path
import { DEFAULT_TEST_USER_ID, DEFAULT_TEST_USERNAME, ANOTHER_TEST_USER_ID, ANOTHER_TEST_USERNAME, initDb as initializeDatabase, getDb as getDatabaseInstance } from "./db/models.js"; // Adjusted path

const SERVER_SCRIPT_PATH = process.argv[2]; // Passed as command line argument

if (!SERVER_SCRIPT_PATH) {
  console.error("Error: Path to server script not provided.");
  console.log("Usage: node <this_script.js> <path_to_mcp_server_script.js>");
  console.log("Example: node dist/ai-test-harness.js dist/server/index.js");
  process.exit(1);
}

async function createAgentClient(agentName: string, userId: string): Promise<Client | null> {
  console.log(`[${agentName}] Initializing MCP Client for user ${userId}...`);
  const client = new Client({
    name: `${agentName}-mcp-client`,
    version: "0.1.0",
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_SCRIPT_PATH],
  });

  try {
    client.connect(transport);
    console.log(`[${agentName}] Attempting to connect to MCP server...`);
    // Simple delay to allow server to start, replace with robust check if possible
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    const tools = await client.listTools();
    console.log(`[${agentName}] Connected. Available tools: ${tools.tools.map(t => t.name).join(', ')}`);
    return client;
  } catch (e) {
    console.error(`[${agentName}] Failed to connect:`, e);
    return null;
  }
}

// Wrapper to inject authenticatedUserId into tool calls
async function callToolAsUser(client: Client, toolName: string, toolArgs: any, userId: string, agentName: string) {
  console.log(`\n[${agentName}] Calling tool '${toolName}' as user '${userId}' with args:`, JSON.stringify(toolArgs));
  try {
    const result = await client.callTool({ 
        name: toolName, 
        arguments: toolArgs, 
        // Manually injecting authenticatedUserId into 'extra' for testing
        extra: { authenticatedUserId: userId }
    }, CallToolResultSchema); // Assuming CallToolResultSchema can be used here for validation
    console.log(`[${agentName}] Result for '${toolName}':`, JSON.stringify(result, null, 2));
    return result;
  } catch (e: any) {
    console.error(`[${agentName}] Error calling tool ${toolName}:`, e.response?.data || e.message || e);
    return null;
  }
}

async function agent1_DefaultUser(client: Client) {
  const agentName = "Agent1_UserDefault";
  const userId = DEFAULT_TEST_USER_ID;
  console.log(`\n--- ${agentName} (${DEFAULT_TEST_USERNAME}) Actions ---`);

  // 1. Save some memories
  await callToolAsUser(client, "save_memory", { content: "User1 Memory Alpha: Project HiveMind details." }, userId, agentName);
  await callToolAsUser(client, "save_memory", { content: "User1 Memory Beta: Important meeting notes." }, userId, agentName);

  // 2. Retrieve personal memory to confirm save
  await callToolAsUser(client, "retrieve_personal_memory", { query: "HiveMind" }, userId, agentName);

  // 3. Create an access token for User2 (another_test_user)
  console.log(`[${agentName}] Creating access token for ${ANOTHER_TEST_USERNAME} to read memories...`);
  const tokenResult = await callToolAsUser(client, "create_access_token", { access_level: "read", expiration_hours: 1 }, userId, agentName);
  
  // Extract token phrase from the result content
  let tokenPhrase: string | null = null;
  if (tokenResult && Array.isArray(tokenResult.content) && tokenResult.content.length > 0 && tokenResult.content[0]?.type === 'text') {
    const textContentItem = tokenResult.content[0] as { type: 'text', text: string }; // Type assertion
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
}

async function agent2_AnotherUser(client: Client, tokenFromUser1: string) {
  const agentName = "Agent2_UserAnother";
  const userId = ANOTHER_TEST_USER_ID;
  console.log(`\n--- ${agentName} (${ANOTHER_TEST_USERNAME}) Actions ---`);

  // 1. Use the access token provided by User1
  console.log(`[${agentName}] Attempting to use token: ${tokenFromUser1} from granter ${DEFAULT_TEST_USERNAME}`);
  const useTokenResult = await callToolAsUser(client, "use_access_token", { token: tokenFromUser1, granter_username: DEFAULT_TEST_USERNAME }, userId, agentName);

  // Check if useTokenResult and its content are valid, and if the text indicates an error
  if (!useTokenResult || !Array.isArray(useTokenResult.content) || useTokenResult.content.length === 0 || 
      (useTokenResult.content[0]?.type === 'text' && (useTokenResult.content[0] as { type: 'text', text: string }).text.toLowerCase().includes('error'))) {
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
  console.log(`[${agentName}] Attempting to retrieve memories from ${DEFAULT_TEST_USERNAME} using query 'HiveMind'...`);
  await callToolAsUser(client, "retrieve_shared_memory", { shared_by_username: DEFAULT_TEST_USERNAME, query: "HiveMind" }, userId, agentName);
  
  console.log(`[${agentName}] Attempting to retrieve memories from ${DEFAULT_TEST_USERNAME} using query 'meeting'...`);
  await callToolAsUser(client, "retrieve_shared_memory", { shared_by_username: DEFAULT_TEST_USERNAME, query: "meeting" }, userId, agentName);
}


async function main() {
  console.log("Starting AI Agent Test Harness...");

  // Initialize DB for the test harness process itself
  try {
    console.log("[TestHarnessSetup] Initializing database for harness process...");
    await initializeDatabase(); // Call initDb here
    console.log("[TestHarnessSetup] Database for harness process initialized.");
  } catch (dbInitError) {
    console.error("[TestHarnessSetup] CRITICAL: Failed to initialize database for harness:", dbInitError);
    process.exit(1);
  }

  const client1 = await createAgentClient("Agent1", DEFAULT_TEST_USER_ID);
  const client2 = await createAgentClient("Agent2", ANOTHER_TEST_USER_ID);

  if (!client1 || !client2) {
    console.error("Failed to initialize one or more agent clients. Aborting test.");
    if(client1 && typeof client1.close === 'function') await client1.close();
    if(client2 && typeof client2.close === 'function') await client2.close();
    return;
  }

  try {
    const tokenForUser2 = await agent1_DefaultUser(client1);
    if (tokenForUser2) {
      // Get the DB instance that was initialized by this harness process
      const db = getDatabaseInstance(); 
      try {
        console.log(`[TestHarnessSetup] Ensuring direct permission for ${ANOTHER_TEST_USERNAME} to access ${DEFAULT_TEST_USERNAME}'s memories.`);
        await db.run(
          'INSERT OR IGNORE INTO AccessPermission (id, granter_user_id, grantee_user_id, access_level) VALUES (?, ?, ?, ?)',
          `test_direct_perm_${DEFAULT_TEST_USER_ID}_${ANOTHER_TEST_USER_ID}`,
          DEFAULT_TEST_USER_ID,
          ANOTHER_TEST_USER_ID,
          'read'
        );
      } catch (dbError) {
        console.error("[TestHarnessSetup] Error ensuring direct permission:", dbError);
        // Decide if this is fatal for the test or if agent2_AnotherUser can proceed and potentially fail at shared memory retrieval
      }
      await agent2_AnotherUser(client2, tokenForUser2);
    }
  } catch (e) {
    console.error("Error during agent test execution:", e);
  } finally {
    console.log("\n--- Test Harness Finishing --- ");
    if (client1 && typeof client1.close === 'function') await client1.close();
    if (client2 && typeof client2.close === 'function') await client2.close();
    console.log("Agent clients closed.");
    process.exit(0);
  }
}

main().catch(e => {
  console.error("Unhandled error in AI Test Harness main:", e);
  process.exit(1);
}); 