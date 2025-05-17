import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import * as readline from "readline";
import { stdin as input, stdout as output } from "process";

// Helper to ask questions - using standard callback-based readline
const rl = readline.createInterface({ input, output });
// Promisify the question method
const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

class SimpleMcpClient {
  private client: Client;
  private transport: StdioClientTransport | undefined;

  constructor() {
    // Client constructor expects at least one argument with configuration
    this.client = new Client({
      name: "simple-mcp-client", // Client name
      version: "0.1.0", // Client version
    });
  }

  async connect(serverScriptPath: string) {
    try {
      if (!serverScriptPath.endsWith(".js")) {
        // Assuming the server is a Node.js script.
        // Add .py check if Python servers are also to be supported.
        throw new Error("Server script must be a .js file for this client.");
      }

      this.transport = new StdioClientTransport({
        command: process.execPath, // path to node executable
        args: [serverScriptPath],
      });

      this.client.connect(this.transport);
      console.log("Attempting to connect to MCP server via stdio...");

      // It might take a moment for the server to start and connect.
      // A robust client might have a handshake or ready check.
      // For simplicity, we'll assume it connects quickly.

      const toolsResult = await this.client.listTools();
      console.log("\nConnected to server. Available tools:", toolsResult.tools.map(t => t.name).join(", ") || "None");
      if (toolsResult.tools.length === 0) {
        console.warn("Warning: No tools reported by the server.");
      }
    } catch (e) {
      console.error("Failed to connect to MCP server:", e);
      throw e;
    }
  }

  async callTool(name: string, args: any) {
    try {
      console.log(`\nCalling tool: ${name} with args:`, JSON.stringify(args));
      const result = await this.client.callTool({ name, arguments: args });
      console.log("Tool call result:", JSON.stringify(result, null, 2));
      return result;
    } catch (e: any) {
      console.error(`Error calling tool ${name}:`, e.response?.data || e.message || e);
      return null;
    }
  }

  async interactiveLoop() {
    console.log("\nEnter 'list' to see tools.");
    console.log("Enter 'call <tool_name> <json_args>' to call a tool (e.g., call create_access_token {\"access_level\":\"read\",\"expiration_hours\":1}).");
    console.log("Enter 'quit' to exit.");

    while (true) {
      const userInput = await question("\nMCP Client > ");
      const parts = userInput.trim().split(/\s+/);
      const command = parts[0];

      if (command === "quit") {
        break;
      } else if (command === "list") {
        const toolsResult = await this.client.listTools();
        console.log("Available tools:", toolsResult.tools.map(t => t.name).join(", ") || "None");
      } else if (command === "call") {
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
          } catch (e) {
            console.error("Invalid JSON arguments. Make sure JSON is well-formed and quoted if it contains spaces:", e);
            continue;
          }
        }
        await this.callTool(toolName, toolArgs);
      } else if (userInput.trim() === "") {
        // Do nothing on empty input
      }
      else {
        console.log("Unknown command. Available commands: list, call, quit");
      }
    }
  }

  async cleanup() {
    if (this.client) {
      try {
        console.log("Closing client connection (stdio transport will terminate server process).");
        // If the client has a close method:
        if (typeof this.client.close === 'function') {
          await this.client.close();
        }
      } catch (e) {
        console.error("Error during cleanup:", e);
      }
    }
    rl.close();
  }
}


async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node <this_script.js> <path_to_mcp_server_script.js>");
    console.log("Example: node dist/test-client.js dist/server/index.js"); // Assuming TS compiles to dist
    return;
  }
  const serverScriptPath = process.argv[2];

  const mcpClient = new SimpleMcpClient();
  try {
    await mcpClient.connect(serverScriptPath);
    await mcpClient.interactiveLoop();
  } catch (e) {
    console.error("An error occurred in the client's main execution:", e);
  } finally {
    await mcpClient.cleanup();
    console.log("MCP Client finished.");
    process.exit(0); // Ensure process exits cleanly
  }
}

main().catch(e => {
  console.error("Unhandled error in main:", e);
  process.exit(1);
});

// Removed String.prototype.splitArgs to simplify and avoid potential issues.
// Users will need to ensure JSON arguments are passed as a single block or correctly quoted. 