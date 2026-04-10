"use strict";
// index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneKeyMCPRouter = void 0;
const crypto = __importStar(require("crypto"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file
dotenv.config();
// --- Constants ---
const KEY_DEEPNLP_ONEKEY_ROUTER_ACCESS = "DEEPNLP_ONEKEY_ROUTER_ACCESS";
const DEFAULT_ENDPOINT = "https://agent.deepnlp.org/mcp";
// --- Helper Functions ---
/**
 * Constructs the JSON-RPC payload for the request.
 */
function buildRpcPayload(method, params, requestId) {
    // Generates a short, unique ID (8 characters) if none is provided.
    const id = requestId || crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    const payload = {
        jsonrpc: "2.0",
        method: method,
        id: id,
    };
    if (params !== undefined) {
        payload.params = params;
    }
    return payload;
}
// --- OneKeyMCPRouter Class Implementation ---
/**
 * Client for the DeepNLP OneKey MCP Router.
 * Facilitates authentication and execution of JSON-RPC methods
 * against various MCP servers via a single access key.
 */
class OneKeyMCPRouter {
    /**
     * Initializes the router client and validates access.
     * @param serverName The MCP Server Name to connect to (e.g., 'google-maps', 'perplexity').
     * @param onekey The access key. Falls back to environment variable.
     * @param endpoint The base URL for the MCP router. Falls back to DEFAULT_ENDPOINT.
     * @param logEnable If true, enables debug logging.
     */
    constructor(serverName, onekey, endpoint, logEnable = false) {
        if (!serverName) {
            console.error("OneKeyMCPRouter init: MCP Server Name cannot be empty.");
            throw new Error("MCP Server Name is required.");
        }
        this.serverName = serverName;
        this.endpoint = endpoint || DEFAULT_ENDPOINT;
        this.logEnable = logEnable;
        this.requestIdCounter = 0;
        const accessKey = process.env[KEY_DEEPNLP_ONEKEY_ROUTER_ACCESS] || onekey;
        if (!accessKey) {
            throw new Error(`Error: OneKey access_key is missing. Please check Env Variable ${KEY_DEEPNLP_ONEKEY_ROUTER_ACCESS} or 'onekey' parameter.`);
        }
        this.onekey = accessKey;
        // Perform initialization check asynchronously
        this.initialize(this.serverName, this.onekey);
    }
    getNextId() {
        // Generates a sequential ID for JSON-RPC requests.
        this.requestIdCounter++;
        return String(this.requestIdCounter);
    }
    /**
     * Generic method to handle the POST request to the MCP endpoint.
     */
    async makeRequest(method, params, requestId) {
        const finalUrl = `${this.endpoint}?server_name=${this.serverName}&onekey=${this.onekey}`;
        const payload = buildRpcPayload(method, params, requestId || this.getNextId());
        if (this.logEnable) {
            console.log(`DEBUG: Request: ${JSON.stringify(payload)} | URL: ${finalUrl}`);
        }
        try {
            const response = await fetch(finalUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP Error: ${response.status} - ${errorText}`);
                return {
                    status: false,
                    data: null,
                    message: `HTTP Error: ${response.status} - ${errorText.substring(0, 100)}...`
                };
            }
            const jsonResponse = await response.json();
            return {
                status: true,
                data: jsonResponse,
                message: "OK"
            };
        }
        catch (e) {
            const error = e;
            console.error(`Request failed: ${error.message}`);
            return {
                status: false,
                data: null,
                message: `Request Error: ${error.message}`
            };
        }
    }
    /**
     * Registers the access key with the server (initial check).
     */
    initialize(serverName, accessKey) {
        if (this.logEnable) {
            console.log(`Attempting to initialize client with server_name ${serverName}`);
        }
        // This is intentionally left as a non-blocking call in the constructor
        this.makeRequest("initialize", { access_key: accessKey }, this.getNextId())
            .then(result => {
            if (this.logEnable) {
                console.log(`Initialization result: ${JSON.stringify(result)}`);
            }
            if (result.status) {
                console.info(`Initialization for server ${serverName} successful.`);
            }
            else {
                console.error(`Initialization for server ${serverName} failed: ${result.message}`);
            }
        })
            .catch(error => {
            console.error(`Initialization failed due to unhandled error: ${error.message}`);
        });
    }
    /**
     * Lists available tools on the target server.
     * @param kwargs Optional arguments for the 'tools/list' method.
     * @returns The JSON-RPC response result, or an empty object on failure.
     */
    async toolsList(kwargs = {}) {
        if (this.logEnable) {
            console.log(`Requesting tool list for server: ${this.serverName}`);
        }
        try {
            const result = await this.makeRequest("tools/list", kwargs);
            if (result.status && result.data) {
                return result.data;
            }
            else {
                return {};
            }
        }
        catch (e) {
            console.error(`Failed to get tool list: ${e.message}`);
            return {};
        }
    }
    /**
     * Performs a tool call to the router.
     * @param toolName The name of the tool to call (e.g., 'maps_directions').
     * @param arguments The arguments for the tool.
     * @returns The JSON-RPC response result, or an empty object on failure.
     */
    async toolsCall(toolName, toolArgs) {
        if (this.logEnable) {
            console.log(`Calling tool: ${toolName} on server: ${this.serverName}`);
        }
        try {
            const params = {
                name: toolName,
                arguments: toolArgs
            };
            const result = await this.makeRequest("tools/call", params);
            if (result.status && result.data) {
                return result.data;
            }
            else {
                return {};
            }
        }
        catch (e) {
            console.error(`Server ${this.serverName} Failed to get tool call result: ${e.message}`);
            return {};
        }
    }
}
exports.OneKeyMCPRouter = OneKeyMCPRouter;
