import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_TEST_USER_ID, DEFAULT_TEST_USERNAME, ANOTHER_TEST_USER_ID, ANOTHER_TEST_USERNAME, initDb, getDb } from "./db/models.js";

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import { stdin as input, stdout as output } from "process";

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

const rl = readline.createInterface({ input, output });

// Promisify rl.question for async/await usage
const question = (promptText: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(promptText, resolve);
  });
};

class ChatbotMcpClient {
  private mcpClient: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | undefined;
  private toolsForLLM: Anthropic.Tool[] = [];
  private currentUserId: string = DEFAULT_TEST_USER_ID;
  private currentUsername: string = DEFAULT_TEST_USERNAME;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    this.mcpClient = new Client({
      name: "chatbot-mcp-client",
      version: "0.1.0",
    });
    console.log("Chatbot MCP Client initialized.");
  }

  async connectToServer(serverPath: string) {
    this.transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
    });

    try {
      this.mcpClient.connect(this.transport);
      console.log("Attempting to connect to MCP server via stdio...");
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mcpTools = await this.mcpClient.listTools();
      this.toolsForLLM = mcpTools.tools.map(tool => ({
        name: tool.name,
        description: tool.description || "",
        input_schema: tool.inputSchema as any,
      }));
      console.log("Connected to MCP server. Available tools for LLM:", this.toolsForLLM.map(t => t.name).join(", "));
      if (this.toolsForLLM.length === 0) {
        console.warn("Warning: No tools reported by the server, LLM will not be able to use any.");
      }
    } catch (e) {
      console.error("Failed to connect to MCP server or list tools:", e);
      throw e;
    }
  }

  async setCurrentUser() {
    const answer = await question(`Simulate as which user? (1: ${DEFAULT_TEST_USERNAME}, 2: ${ANOTHER_TEST_USERNAME}, default: 1): `);
    if (answer.trim() === '2') {
      this.currentUserId = ANOTHER_TEST_USER_ID;
      this.currentUsername = ANOTHER_TEST_USERNAME;
    } else {
      this.currentUserId = DEFAULT_TEST_USER_ID;
      this.currentUsername = DEFAULT_TEST_USERNAME;
    }
    console.log(`Chatting as: ${this.currentUsername} (ID: ${this.currentUserId})`);
    if (this.currentUserId === ANOTHER_TEST_USER_ID) {
        try {
            await initDb();
            const db = getDb();
            console.log(`[ChatbotSetup] Ensuring direct permission for ${ANOTHER_TEST_USERNAME} to access ${DEFAULT_TEST_USERNAME}'s memories.`);
            await db.run(
              'INSERT OR IGNORE INTO AccessPermission (id, granter_user_id, grantee_user_id, access_level) VALUES (?, ?, ?, ?)',
              `chatbot_direct_perm_${DEFAULT_TEST_USER_ID}_${ANOTHER_TEST_USER_ID}`,
              DEFAULT_TEST_USER_ID,
              ANOTHER_TEST_USER_ID,
              'read'
            );
        } catch (dbError) {
            console.error("[ChatbotSetup] Error ensuring direct permission:", dbError);
        }
    }
  }

  async processMessage(userMessage: string): Promise<string> {
    console.log(`\n${this.currentUsername} (You): ${userMessage}`);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

    try {
      let response = await this.anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 2048,
        messages: messages,
        tools: this.toolsForLLM.length > 0 ? this.toolsForLLM : undefined,
      });

      while (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter(
            (c: Anthropic.ContentBlock): c is Anthropic.ToolUseBlock => c.type === "tool_use"
        );
        if (toolUses.length === 0) {
            console.warn("LLM indicated tool_use but no tool_use blocks found.");
            break; 
        }

        messages.push({ role: "assistant", content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
          console.log(`LLM wants to use tool: ${toolUse.name} with ID: ${toolUse.id} and args: ${JSON.stringify(toolUse.input)}`);
          const mcpToolResult = await this.mcpClient.callTool(
            { 
              name: toolUse.name, 
              arguments: toolUse.input as { [key: string]: any },
              extra: { authenticatedUserId: this.currentUserId } 
            },
            CallToolResultSchema
          );
          
          let toolOutputText = "Error processing tool result or no content.";
          if (mcpToolResult && Array.isArray(mcpToolResult.content) && mcpToolResult.content.length > 0 && mcpToolResult.content[0]?.type === 'text') {
            const textContentItem = mcpToolResult.content[0] as { type: 'text', text: string };
            toolOutputText = textContentItem.text;
          }
          console.log(`MCP Tool '${toolUse.name}' raw result: ${toolOutputText}`);
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: toolOutputText });
        }
        messages.push({ role: "user", content: toolResults });

        response = await this.anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 2048,
          messages: messages,
          tools: this.toolsForLLM.length > 0 ? this.toolsForLLM : undefined,
        });
      }

      const finalResponseText = response.content
        .filter((c: Anthropic.ContentBlock): c is Anthropic.TextBlock => c.type === "text")
        .map((c: Anthropic.TextBlock) => c.text)
        .join("\n");
      
      console.log(`SkyNet LLM (${this.currentUsername}'s Agent): ${finalResponseText}`);
      return finalResponseText;

    } catch (error) {
      console.error("Error processing message with LLM or MCP tools:", error);
      return "I encountered an error. Please try again.";
    }
  }

  async startChatLoop() {
    await this.setCurrentUser();
    console.log(`Starting chat. Type 'quit' or 'exit' to end.`);
    while (true) {
      const userInput = await question("> ");
      if (userInput.toLowerCase() === "quit" || userInput.toLowerCase() === "exit") {
        break;
      }
      if (userInput.trim() === "") continue;
      await this.processMessage(userInput);
    }
  }

  async cleanup() {
    console.log("Shutting down chatbot client...");
    if (this.mcpClient && typeof this.mcpClient.close === 'function') {
      await this.mcpClient.close();
    }
    rl.close();
  }
}

async function main() {
  const chatbot = new ChatbotMcpClient();
  try {
    await chatbot.connectToServer(SERVER_SCRIPT_PATH);
    await chatbot.startChatLoop();
  } catch (error) {
    console.error("Critical error in chatbot main execution:", error);
  } finally {
    await chatbot.cleanup();
    console.log("Chatbot client finished.");
    process.exit(0);
  }
}

main().catch(e => {
  console.error("Unhandled fatal error:", e);
  process.exit(1);
}); 