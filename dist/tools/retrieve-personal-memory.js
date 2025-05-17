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
exports.retrievePersonalMemoryHandler = exports.RetrievePersonalMemoryInputSchema = exports.retrievePersonalMemoryDescription = exports.retrievePersonalMemoryName = void 0;
const zod_1 = require("zod");
const sequelize_1 = require("sequelize"); // Assuming Sequelize and Op for LIKE query
// Assuming Memory model type will be available via db.models.Memory
exports.retrievePersonalMemoryName = "retrieve_personal_memory";
exports.retrievePersonalMemoryDescription = "Retrieve your own memories based on a search query.";
exports.RetrievePersonalMemoryInputSchema = zod_1.z.object({
    query: zod_1.z.string().min(1, "Search query cannot be empty."),
});
function retrievePersonalMemoryHandler(input, req, db // db is the Sequelize instance
) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            // This case should ideally be prevented by the authMiddleware.
            return {
                structuredContent: {},
                content: [{
                        type: "text",
                        text: "Error: User not authenticated. Cannot retrieve memories."
                    }]
            };
        }
        const { query } = input;
        try {
            // Access the Memory model through the db instance
            const MemoryModel = db.models.Memory;
            if (!MemoryModel) {
                console.error("Memory model is not defined on db.models");
                return {
                    structuredContent: {},
                    content: [{
                            type: "text",
                            text: "Error: Server configuration issue, Memory model not found."
                        }]
                };
            }
            const memories = yield MemoryModel.findAll({
                where: {
                    user_id: userId,
                    content: {
                        [sequelize_1.Op.like]: `%${query}%`, // Case-insensitive search for most SQL dialects
                    },
                },
                order: [['createdAt', 'DESC']],
                limit: 10, // Limit the number of results to keep responses manageable
            });
            if (!memories || memories.length === 0) {
                return {
                    structuredContent: {},
                    content: [{
                            type: "text",
                            text: "No memories found matching your query."
                        }]
                };
            }
            return {
                structuredContent: {},
                content: memories.map((mem) => ({
                    type: "text",
                    text: `Memory (ID: ${mem.id}): "${mem.content}" (Recalled from: ${mem.createdAt.toISOString().split('T')[0]})`
                }))
            };
        }
        catch (error) {
            console.error("Error in retrievePersonalMemoryHandler:", error);
            // Provide a generic error message to the user
            return {
                structuredContent: {},
                content: [{
                        type: "text",
                        text: `An error occurred while retrieving memories: ${error.message}`
                    }]
            };
        }
    });
}
exports.retrievePersonalMemoryHandler = retrievePersonalMemoryHandler;
