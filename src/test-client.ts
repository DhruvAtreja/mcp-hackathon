import { saveMemoryHandler } from './tools/save-memory';
import { retrievePersonalMemoryHandler } from './tools/retrieve-personal-memory';
import { initDb } from './db/models';
import { AuthenticatedRequest } from './server/auth';

// Mock AuthenticatedRequest - cast to any to bypass Express request properties
const mockRequest = {
  user: {
    id: 'test_user_1_uuid',
    username: 'testuser1'
  }
} as unknown as AuthenticatedRequest;

async function main() {
  console.log('Starting test client...');
  
  // Initialize database
  const db = await initDb();
  console.log('Database initialized');
  
  try {
    // Test save_memory tool
    console.log('\n--- Testing save_memory tool ---');
    const saveResult = await saveMemoryHandler(
      { content: 'This is a test memory created directly!' },
      mockRequest,
      db as any // Cast to any to bypass Sequelize type check
    );
    console.log('Save memory result:', JSON.stringify(saveResult, null, 2));
    
    // Test retrieve_personal_memory tool
    console.log('\n--- Testing retrieve_personal_memory tool ---');
    const retrieveResult = await retrievePersonalMemoryHandler(
      { query: 'test' },
      mockRequest,
      db as any // Cast to any to bypass Sequelize type check
    );
    console.log('Retrieve memory result:', JSON.stringify(retrieveResult, null, 2));
    
    console.log('\nTests completed successfully!');
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

main().catch(console.error); 