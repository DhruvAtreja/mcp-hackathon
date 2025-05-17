import express, { Request, Response } from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { initDb } from '@src/db/models';
import { authMiddleware } from './auth';
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

  // Register tools (example, will be fleshed out later)
  // mcpServer.registerTool(saveMemoryTool);
  // mcpServer.registerTool(retrievePersonalMemoryTool);
  // mcpServer.registerTool(createAccessTokenTool);
  // mcpServer.registerTool(useAccessTokenTool);
  // mcpServer.registerTool(retrieveSharedMemoryTool);

  // Setup MCP transport
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => "", // Return an empty string for the session ID
    // Add any other transport-specific options here if needed
  });

  // Connect server to transport
  await mcpServer.connect(mcpTransport);

  // Apply auth middleware and MCP handler to MCP routes
  app.all('/mcp', authMiddleware, async (req: Request, res: Response) => {
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