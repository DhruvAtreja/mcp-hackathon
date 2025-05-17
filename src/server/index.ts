import express, { Request, Response } from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { initDb } from '@src/db/models';
import { authMiddleware, AuthenticatedRequest } from './auth';
// Import the refactored tool components
import { 
  saveMemoryName,
  SaveMemoryInputSchema,
  saveMemoryHandler,
  saveMemoryDescription // We capture description, though server.tool() might not use it directly
} from '@src/tools/save-memory';
// Import tool handlers here once created

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('Server is healthy');
});

async function main() {
  // Initialize database
  const db = await initDb();

  // Initialize MCP Server
  const mcpServer = new McpServer({
    name: "SkyNetMCPServer",
    version: "1.0.0",
    // logger: console, // Optional: for verbose logging
  });

  // Register tools using the 5-argument server.tool() method
  mcpServer.tool(
    saveMemoryName,
    saveMemoryDescription, 
    SaveMemoryInputSchema.shape, 
    { title: saveMemoryDescription }, // Annotations: using description as title for now
    saveMemoryHandler
  );
  // For description, it might be that the McpServer constructor can take a general
  // description, or tools are expected to have self-descriptive names.
  // Or, the description might be part of an options object for server.tool if it exists.
  // For now, `saveMemoryDescription` is not directly used in this registration call.

  // Setup MCP transport
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => "", // Return an empty string for the session ID
    // Add any other transport-specific options here if needed
  });

  // Connect server to transport
  await mcpServer.connect(mcpTransport);

  // Apply auth middleware and MCP handler to MCP routes
  app.all('/mcp', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await mcpTransport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
        });
      }
    }
  });

  app.get('/', (req: Request, res: Response) => {
    res.send('SkyNet MCP Server is running!');
  });

  app.listen(PORT, () => {
    console.log(`SkyNet MCP Server listening at http://localhost:${PORT}`);
  });
}

main().catch(console.error);

console.log("Relinting index.ts after save-memory.ts handler return type change."); 