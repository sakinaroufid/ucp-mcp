#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const AjvInstance = Ajv.default || Ajv;
const addFormatsToAjv = addFormats.default || addFormats;
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPEC_DIR = path.join(__dirname, "..", "spec");
const SOURCE_DIR = path.join(__dirname, "..", "source");

// Initialize AJV for JSON Schema validation
const ajv = new AjvInstance({ allErrors: true, strict: false });
addFormatsToAjv(ajv);

// Schema cache
const schemaCache = new Map<string, object>();

/**
 * Recursively find all JSON files in a directory
 */
function findJsonFiles(dir: string, prefix = ""): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(fullPath, relativePath));
    } else if (entry.name.endsWith(".json")) {
      files.push(relativePath);
    }
  }
  return files;
}

/**
 * Load a JSON file
 */
function loadJson(filePath: string): object | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get schema by name (e.g., "shopping/checkout" or "ucp")
 */
function getSchema(schemaName: string): object | null {
  // Check cache first
  if (schemaCache.has(schemaName)) {
    return schemaCache.get(schemaName)!;
  }
  
  // Try different paths
  const possiblePaths = [
    path.join(SPEC_DIR, "schemas", `${schemaName}.json`),
    path.join(SPEC_DIR, "schemas", schemaName, "index.json"),
    path.join(SPEC_DIR, schemaName),
    path.join(SOURCE_DIR, "schemas", `${schemaName}.json`),
  ];
  
  for (const p of possiblePaths) {
    const schema = loadJson(p);
    if (schema) {
      schemaCache.set(schemaName, schema);
      return schema;
    }
  }
  
  return null;
}

/**
 * List all available schemas
 */
function listSchemas(): { name: string; title?: string; description?: string }[] {
  const schemas: { name: string; title?: string; description?: string }[] = [];
  const schemaDir = path.join(SPEC_DIR, "schemas");
  const files = findJsonFiles(schemaDir);
  
  for (const file of files) {
    const schemaPath = path.join(schemaDir, file);
    const schema = loadJson(schemaPath) as { title?: string; description?: string } | null;
    const name = file.replace(/\.json$/, "");
    
    schemas.push({
      name,
      title: schema?.title,
      description: schema?.description,
    });
  }
  
  return schemas;
}

/**
 * Validate JSON against a schema
 */
function validateJson(schemaName: string, data: unknown): { valid: boolean; errors?: string[] } {
  const schema = getSchema(schemaName);
  if (!schema) {
    return { valid: false, errors: [`Schema '${schemaName}' not found`] };
  }
  
  try {
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map(e => `${e.instancePath} ${e.message}`),
      };
    }
    
    return { valid: true };
  } catch (e: unknown) {
    return { valid: false, errors: [`Validation error: ${e}`] };
  }
}

/**
 * Get UCP capabilities from the spec
 */
function getCapabilities(): object {
  const capabilitySchema = loadJson(path.join(SPEC_DIR, "schemas", "capability.json"));
  const shoppingSchemas = findJsonFiles(path.join(SPEC_DIR, "schemas", "shopping"));
  
  return {
    core: {
      checkout: {
        description: "Facilitates checkout sessions including cart management and tax calculation",
        schemas: shoppingSchemas.filter(s => s.includes("checkout")),
      },
      order: {
        description: "Webhook-based updates for order lifecycle events",
        schemas: shoppingSchemas.filter(s => s.includes("order")),
      },
      payment: {
        description: "Payment handling and token exchange",
        schemas: shoppingSchemas.filter(s => s.includes("payment")),
      },
      fulfillment: {
        description: "Fulfillment options and shipping",
        schemas: shoppingSchemas.filter(s => s.includes("fulfillment")),
      },
    },
    extensions: {
      discount: {
        description: "Discount and promotional pricing",
        schemas: shoppingSchemas.filter(s => s.includes("discount")),
      },
      buyer_consent: {
        description: "Buyer consent management",
        schemas: shoppingSchemas.filter(s => s.includes("buyer_consent")),
      },
    },
    capabilitySchema,
  };
}

// Create the MCP server
const server = new Server(
  {
    name: "ucp-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_schemas",
        description: "List all available UCP schemas with their titles and descriptions",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by category (e.g., 'shopping', 'types', 'discovery')",
            },
          },
        },
      },
      {
        name: "get_schema",
        description: "Get a specific UCP schema by name. Returns the full JSON Schema definition.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Schema name (e.g., 'shopping/checkout_resp', 'ucp', 'shopping/types/line_item_resp')",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "validate_json",
        description: "Validate a JSON object against a UCP schema",
        inputSchema: {
          type: "object",
          properties: {
            schema_name: {
              type: "string",
              description: "Name of the schema to validate against",
            },
            data: {
              type: "object",
              description: "JSON data to validate",
            },
          },
          required: ["schema_name", "data"],
        },
      },
      {
        name: "get_openapi_spec",
        description: "Get the UCP Shopping REST API OpenAPI 3.1 specification",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_openrpc_spec",
        description: "Get the UCP Shopping MCP/JSON-RPC OpenRPC specification",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_capabilities",
        description: "List all UCP capabilities (Checkout, Order, Payment, Fulfillment) and extensions",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_discovery_profile_schema",
        description: "Get the UCP discovery profile schema (/.well-known/ucp format)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "discover_merchant",
        description: "Discover UCP capabilities from a merchant's well-known URL. Fetches and parses /.well-known/ucp",
        inputSchema: {
          type: "object",
          properties: {
            merchant_url: {
              type: "string",
              description: "Base URL of the merchant (e.g., 'https://shop.example.com')",
            },
          },
          required: ["merchant_url"],
        },
      },
      {
        name: "generate_checkout_request",
        description: "Generate a sample checkout create request based on the schema",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Array of items with name, quantity, and price_cents",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  price_cents: { type: "number" },
                },
              },
            },
            currency: {
              type: "string",
              description: "ISO 4217 currency code (default: USD)",
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "list_schemas": {
      const schemas = listSchemas();
      const category = (args as { category?: string })?.category;
      
      const filtered = category
        ? schemas.filter(s => s.name.includes(category))
        : schemas;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    }
    
    case "get_schema": {
      const schemaName = (args as { name: string }).name;
      const schema = getSchema(schemaName);
      
      if (!schema) {
        return {
          content: [
            {
              type: "text",
              text: `Schema '${schemaName}' not found. Use list_schemas to see available schemas.`,
            },
          ],
          isError: true,
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
    
    case "validate_json": {
      const { schema_name, data } = args as { schema_name: string; data: unknown };
      const result = validateJson(schema_name, data);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
    
    case "get_openapi_spec": {
      const spec = loadJson(path.join(SPEC_DIR, "services", "shopping", "rest.openapi.json"));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(spec, null, 2),
          },
        ],
      };
    }
    
    case "get_openrpc_spec": {
      const spec = loadJson(path.join(SPEC_DIR, "services", "shopping", "mcp.openrpc.json"));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(spec, null, 2),
          },
        ],
      };
    }
    
    case "list_capabilities": {
      const capabilities = getCapabilities();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(capabilities, null, 2),
          },
        ],
      };
    }
    
    case "get_discovery_profile_schema": {
      const schema = loadJson(path.join(SPEC_DIR, "discovery", "profile_schema.json"));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
    
    case "discover_merchant": {
      const { merchant_url } = args as { merchant_url: string };
      
      try {
        const wellKnownUrl = new URL("/.well-known/ucp", merchant_url).toString();
        const response = await fetch(wellKnownUrl);
        
        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to discover merchant: HTTP ${response.status}`,
              },
            ],
            isError: true,
          };
        }
        
        const profile = await response.json();
        
        // Validate against profile schema
        const validation = validateJson("discovery/profile_schema", profile);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                profile,
                validation,
              }, null, 2),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Discovery failed: ${e}`,
            },
          ],
          isError: true,
        };
      }
    }
    
    case "generate_checkout_request": {
      const { items = [], currency = "USD" } = args as { 
        items?: Array<{ name: string; quantity: number; price_cents: number }>;
        currency?: string;
      };
      
      const lineItems = items.map((item, idx) => ({
        id: `item_${idx + 1}`,
        name: item.name,
        quantity: item.quantity,
        unit_price: {
          amount_cents: item.price_cents,
          currency,
        },
      }));
      
      const checkoutRequest = {
        ucp: {
          version: "2026-01-11",
          capabilities: ["dev.ucp.shopping.checkout"],
        },
        line_items: lineItems.length > 0 ? lineItems : [
          {
            id: "item_1",
            name: "Sample Product",
            quantity: 1,
            unit_price: {
              amount_cents: 1999,
              currency,
            },
          },
        ],
        currency,
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(checkoutRequest, null, 2),
          },
        ],
      };
    }
    
    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

// List available resources (schemas)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const schemas = listSchemas();
  
  return {
    resources: [
      // Core specs
      {
        uri: "ucp://spec/rest-openapi",
        name: "UCP REST OpenAPI Spec",
        description: "OpenAPI 3.1 specification for UCP Shopping REST API",
        mimeType: "application/json",
      },
      {
        uri: "ucp://spec/mcp-openrpc",
        name: "UCP MCP OpenRPC Spec",
        description: "OpenRPC specification for UCP Shopping MCP interface",
        mimeType: "application/json",
      },
      {
        uri: "ucp://spec/discovery-profile",
        name: "UCP Discovery Profile Schema",
        description: "JSON Schema for merchant discovery profile",
        mimeType: "application/json",
      },
      // Schema resources
      ...schemas.slice(0, 50).map(schema => ({
        uri: `ucp://schema/${schema.name}`,
        name: schema.title || schema.name,
        description: schema.description || `UCP schema: ${schema.name}`,
        mimeType: "application/json",
      })),
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri === "ucp://spec/rest-openapi") {
    const spec = loadJson(path.join(SPEC_DIR, "services", "shopping", "rest.openapi.json"));
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(spec, null, 2),
        },
      ],
    };
  }
  
  if (uri === "ucp://spec/mcp-openrpc") {
    const spec = loadJson(path.join(SPEC_DIR, "services", "shopping", "mcp.openrpc.json"));
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(spec, null, 2),
        },
      ],
    };
  }
  
  if (uri === "ucp://spec/discovery-profile") {
    const spec = loadJson(path.join(SPEC_DIR, "discovery", "profile_schema.json"));
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(spec, null, 2),
        },
      ],
    };
  }
  
  if (uri.startsWith("ucp://schema/")) {
    const schemaName = uri.replace("ucp://schema/", "");
    const schema = getSchema(schemaName);
    
    if (schema) {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
  }
  
  throw new Error(`Resource not found: ${uri}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UCP MCP Server running on stdio");
}

main().catch(console.error);

