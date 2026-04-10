// index.ts

import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

/** The standard structure for a JSON-RPC request. */
export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: any;
}

/** The standard structure for a successful JSON-RPC response. */
export interface JsonRpcSuccessResponse {
    jsonrpc: "2.0";
    id: string | number;
    result: any;
}

/** The standard structure for a JSON-RPC error response. */
export interface JsonRpcErrorResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    error: {
        code: number;
        message: string;
        data?: any;
    };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/** Parameters specific to the tools/call method. */
export interface ToolCallParams {
    name: string;
    arguments: Record<string, any>;
}

/** Interface for the internal request result. */
export interface RouterRequestResult {
    status: boolean;
    data: JsonRpcResponse | null;
    message: string;
}

// --- Constants ---

const KEY_DEEPNLP_ONEKEY_ROUTER_ACCESS = "DEEPNLP_ONEKEY_ROUTER_ACCESS";
const DEFAULT_ENDPOINT = "https://agent.deepnlp.org/mcp";

// --- Helper Functions ---

/**
 * Constructs the JSON-RPC payload for the request.
 */
function buildRpcPayload(method: string, params?: any, requestId?: string): JsonRpcRequest {
    // Generates a short, unique ID (8 characters) if none is provided.
    const id = requestId || crypto.randomUUID().replace(/-/g, '').substring(0, 8);

    const payload: JsonRpcRequest = {
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
export class OneKeyMCPRouter {
    private serverName: string;
    private endpoint: string;
    private onekey: string;
    private logEnable: boolean;
    private requestIdCounter: number;

    /**
     * Initializes the router client and validates access.
     * @param serverName The MCP Server Name to connect to (e.g., 'google-maps', 'perplexity').
     * @param onekey The access key. Falls back to environment variable.
     * @param endpoint The base URL for the MCP router. Falls back to DEFAULT_ENDPOINT.
     * @param logEnable If true, enables debug logging.
     */
    constructor(serverName: string, onekey?: string, endpoint?: string, logEnable: boolean = false) {
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
            throw new Error(
                `Error: OneKey access_key is missing. Please check Env Variable ${KEY_DEEPNLP_ONEKEY_ROUTER_ACCESS} or 'onekey' parameter.`
            );
        }
        this.onekey = accessKey;

        // Perform initialization check asynchronously
        this.initialize(this.serverName, this.onekey);
    }

    private getNextId(): string {
        // Generates a sequential ID for JSON-RPC requests.
        this.requestIdCounter++;
        return String(this.requestIdCounter);
    }

    /**
     * Generic method to handle the POST request to the MCP endpoint.
     */
    private async makeRequest(
        method: string,
        params?: any,
        requestId?: string
    ): Promise<RouterRequestResult> {

        const finalUrl = `${this.endpoint}?server_name=${this.serverName}&onekey=${this.onekey}`;

        const payload = buildRpcPayload(
            method,
            params,
            requestId || this.getNextId()
        );

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
            } as RouterRequestResult;

        } catch (e) {
            const error = e as Error;
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
    public initialize(serverName: string, accessKey: string): void {
        if (this.logEnable) {
            console.log(`Attempting to initialize client with server_name ${serverName}`);
        }

        // This is intentionally left as a non-blocking call in the constructor
        this.makeRequest(
            "initialize",
            { access_key: accessKey },
            this.getNextId()
        )
        .then(result => {
            if (this.logEnable) {
                console.log(`Initialization result: ${JSON.stringify(result)}`);
            }
            if (result.status) {
                console.info(`Initialization for server ${serverName} successful.`);
            } else {
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
    public async toolsList(kwargs: Record<string, any> = {}): Promise<JsonRpcResponse | {}> {
        if (this.logEnable) {
            console.log(`Requesting tool list for server: ${this.serverName}`);
        }

        try {
            const result = await this.makeRequest(
                "tools/list",
                kwargs,
            );

            if (result.status && result.data) {
                return result.data;
            } else {
                return {};
            }
        } catch (e) {
            console.error(`Failed to get tool list: ${(e as Error).message}`);
            return {};
        }
    }

    /**
     * Performs a tool call to the router.
     * @param toolName The name of the tool to call (e.g., 'maps_directions').
     * @param arguments The arguments for the tool.
     * @returns The JSON-RPC response result, or an empty object on failure.
     */
    public async toolsCall(toolName: string, toolArgs: Record<string, any>): Promise<JsonRpcResponse | {}> {
        if (this.logEnable) {
            console.log(`Calling tool: ${toolName} on server: ${this.serverName}`);
        }

        try {
            const params: ToolCallParams = {
                name: toolName,
                arguments: toolArgs
            };

            const result = await this.makeRequest(
                "tools/call",
                params
            );

            if (result.status && result.data) {
                return result.data;
            } else {
                return {};
            }
        } catch (e) {
            console.error(`Server ${this.serverName} Failed to get tool call result: ${(e as Error).message}`);
            return {};
        }
    }
}
