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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)();
const API_URL = 'http://localhost:3000/mcp';
const AUTH_TOKEN = 'test_user_1_token';
function saveMemory(content) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(API_URL, {
                jsonrpc: '2.0',
                id: 'save-memory-' + Date.now(),
                method: 'tool/call',
                params: {
                    name: 'save_memory',
                    arguments: { content }
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            console.log('Memory saved:', response.data.result.structuredContent);
            return response.data.result.structuredContent.memoryId;
        }
        catch (error) {
            console.error('Error saving memory:', error);
            return null;
        }
    });
}
function retrieveMemories(query) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(API_URL, {
                jsonrpc: '2.0',
                id: 'retrieve-memory-' + Date.now(),
                method: 'tool/call',
                params: {
                    name: 'retrieve_personal_memory',
                    arguments: { query }
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            console.log('Memories retrieved:', response.data.result.structuredContent);
            return response.data.result.structuredContent.memories;
        }
        catch (error) {
            console.error('Error retrieving memories:', error);
            return [];
        }
    });
}
function runTest() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('--- Starting Memory Retrieval Test ---');
        // Save some test memories
        const memoryIds = [];
        memoryIds.push(yield saveMemory('My favorite color is blue'));
        memoryIds.push(yield saveMemory('I visited Paris last summer and loved the Eiffel Tower'));
        memoryIds.push(yield saveMemory('The recipe for chocolate chip cookies requires 2 cups of flour'));
        memoryIds.push(yield saveMemory('My dog\'s name is Max and he likes to play fetch'));
        console.log('Saved memory IDs:', memoryIds.filter(Boolean));
        // Wait a moment for memories to be saved
        yield new Promise(r => setTimeout(r, 1000));
        // Test different queries
        console.log('\n--- Testing Memory Retrieval ---');
        yield retrieveMemories('color');
        yield retrieveMemories('paris');
        yield retrieveMemories('recipe');
        yield retrieveMemories('dog');
        yield retrieveMemories('something that doesn\'t exist');
        console.log('\n--- Memory Retrieval Test Complete ---');
    });
}
// Execute the test
runTest().catch(console.error);
