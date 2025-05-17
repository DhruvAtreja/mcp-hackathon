import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initDb } from "../db/models";

// Import tool registration functions from access-control.ts
import {
  registerCreateAccessTokenTool,
  registerUseAccessTokenTool,
  registerRetrieveSharedMemoryTool,
} from "../tools/access-control.js";
import { registerSaveMemoryTool } from "../tools/save-memory.js";
import { registerRetrievePersonalMemoryTool } from "../tools/retrieve-personal-memory.js";

async function main() {
  console.error("SkyNet MCP Server: Initializing database...");
  await initDb();
  console.error("SkyNet MCP Server: Database initialized.");

  // Use console.error for server-side logging to keep stdout clean for JSON-RPC
  console.error("SkyNet MCP Server: Initializing...");

  const server = new McpServer(
    {
      name: "skynet-mcp-server",
      version: "0.1.0",
      capabilities: {
        tools: {}, // Declare that this server provides tools
        // resources: {}, // Future use
        // prompts: {},   // Future use
      },
    }
  );

  console.error("SkyNet MCP Server: Registering tools...");
  // Register the access control tools
  registerCreateAccessTokenTool(server);
  registerUseAccessTokenTool(server);
  registerRetrieveSharedMemoryTool(server);

  // Register memory tools
  registerSaveMemoryTool(server);
  registerRetrievePersonalMemoryTool(server);

  // TODO: Register other tools from the plan (save_memory, retrieve_personal_memory) if/when implemented
  // e.g.:
  // import { registerSaveMemoryTool } from "../tools/save-memory.js";
  // import { registerRetrievePersonalMemoryTool } from "../tools/retrieve-personal-memory.js";
  // registerSaveMemoryTool(server); (assuming it's updated for the new McpServer API)
  // registerRetrievePersonalMemoryTool(server); (assuming it's updated)

  console.error("SkyNet MCP Server: All tools registered.");

  const transport = new StdioServerTransport();
  
  try {
    // Connect the server instance to the chosen transport
    await server.connect(transport);
    console.error("SkyNet MCP Server: Connected to stdio transport. Listening for requests...");
  } catch (error) {
    console.error("SkyNet MCP Server: Fatal error during server connection or while running:", error);
    process.exit(1); // Exit if the server cannot start or encounters a fatal error
  }

  // The server is now running and will handle requests over stdio.
  // It will continue until the transport is closed (e.g., client disconnects).
}

main().catch((error) => {
  console.error("SkyNet MCP Server: Unhandled fatal error in main execution:", error);
  process.exit(1);
}); 