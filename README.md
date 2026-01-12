# UCP MCP Server

An MCP (Model Context Protocol) server that exposes the [Universal Commerce Protocol (UCP)](https://github.com/Universal-Commerce-Protocol/ucp) schemas, specifications, and tools for AI agents.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What is UCP?

The Universal Commerce Protocol is an open standard enabling interoperability between commerce entities (AI agents, platforms, merchants, PSPs) to facilitate seamless commerce integrations. Learn more at [ucp.dev](https://ucp.dev).

## Features

### Tools

| Tool | Description |
|------|-------------|
| `list_schemas` | List all available UCP schemas with titles and descriptions |
| `get_schema` | Get a specific UCP schema by name |
| `validate_json` | Validate JSON data against a UCP schema |
| `get_openapi_spec` | Get the UCP Shopping REST API OpenAPI 3.1 spec |
| `get_openrpc_spec` | Get the UCP Shopping MCP/JSON-RPC OpenRPC spec |
| `list_capabilities` | List all UCP capabilities and extensions |
| `get_discovery_profile_schema` | Get the UCP discovery profile schema |
| `discover_merchant` | Discover UCP capabilities from a merchant's `/.well-known/ucp` |
| `generate_checkout_request` | Generate sample checkout request payloads |

### Resources

- **REST OpenAPI Spec** (`ucp://spec/rest-openapi`)
- **MCP OpenRPC Spec** (`ucp://spec/mcp-openrpc`)
- **Discovery Profile Schema** (`ucp://spec/discovery-profile`)
- **All UCP Schemas** (`ucp://schema/{name}`) — 50+ schemas

## Installation

```bash
git clone https://github.com/sakinaroufid/ucp-mcp.git
cd ucp-mcp
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ucp": {
      "command": "node",
      "args": ["/path/to/ucp-mcp/dist/index.js"]
    }
  }
}
```

### With Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "ucp": {
      "command": "node",
      "args": ["/path/to/ucp-mcp/dist/index.js"]
    }
  }
}
```

## Example Usage

### List available schemas

```
list_schemas(category: "checkout")
```

Returns:
```json
[
  { "name": "shopping/checkout_resp", "title": "Checkout Response" },
  { "name": "shopping/checkout.create_req", "title": "Checkout Create Request" },
  { "name": "shopping/checkout.update_req", "title": "Checkout Update Request" }
]
```

### Get checkout response schema

```
get_schema(name: "shopping/checkout_resp")
```

### Generate checkout request

```
generate_checkout_request(
  items: [
    { name: "MacBook Pro", quantity: 1, price_cents: 199900 },
    { name: "USB-C Cable", quantity: 2, price_cents: 2999 }
  ],
  currency: "USD"
)
```

Returns:
```json
{
  "ucp": {
    "version": "2026-01-11",
    "capabilities": ["dev.ucp.shopping.checkout"]
  },
  "line_items": [
    {
      "id": "item_1",
      "name": "MacBook Pro",
      "quantity": 1,
      "unit_price": { "amount_cents": 199900, "currency": "USD" }
    },
    {
      "id": "item_2", 
      "name": "USB-C Cable",
      "quantity": 2,
      "unit_price": { "amount_cents": 2999, "currency": "USD" }
    }
  ],
  "currency": "USD"
}
```

### Discover a merchant's UCP capabilities

```
discover_merchant(merchant_url: "https://shop.example.com")
```

## UCP Capabilities

| Capability | Description |
|------------|-------------|
| **Checkout** | Cart management, tax calculation, checkout flows |
| **Order** | Webhook-based order lifecycle events (shipped, delivered, returned) |
| **Payment** | Payment handling and token exchange |
| **Fulfillment** | Shipping options and delivery methods |

### Extensions

- **Discount** — Promotional pricing and discounts
- **Buyer Consent** — Consent management for data collection
- **AP2 Mandate** — Cryptographic authorization per AP2 protocol

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

## Related Links

- [UCP Specification](https://ucp.dev)
- [UCP GitHub Repository](https://github.com/Universal-Commerce-Protocol/ucp)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

Apache-2.0 (same as UCP)
