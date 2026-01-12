# ucp-mcp

MCP server for [UCP](https://github.com/Universal-Commerce-Protocol/ucp). Gives your LLM access to all the UCP schemas, specs, and a few handy tools.

## Why?

UCP (Universal Commerce Protocol) defines how commerce stuff should talk to each other — checkout flows, payments, fulfillment, etc. This MCP server lets you query those definitions, validate payloads against them, and poke around merchant discovery endpoints.

## Tools

- `list_schemas` — browse all 50+ UCP schemas
- `get_schema` — grab a specific schema by name
- `validate_json` — check if your JSON matches a schema
- `get_openapi_spec` — the REST API spec (OpenAPI 3.1)
- `get_openrpc_spec` — the JSON-RPC spec
- `list_capabilities` — what UCP can do (checkout, payment, fulfillment, etc)
- `get_discovery_profile_schema` — the `/.well-known/ucp` schema
- `discover_merchant` — hit a merchant's discovery endpoint and see what they support
- `generate_checkout_request` — spit out a sample checkout payload

## Setup

```bash
git clone https://github.com/sakinaroufid/ucp-mcp.git
cd ucp-mcp
npm install
npm run build
```

## Add to Cursor / Claude Desktop

Drop this in your MCP config:

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

## Quick examples

**Find checkout schemas:**
```
list_schemas(category: "checkout")
```

**Generate a test checkout:**
```
generate_checkout_request(
  items: [
    { name: "Keyboard", quantity: 1, price_cents: 14900 }
  ],
  currency: "USD"
)
```

**Check what a merchant supports:**
```
discover_merchant(merchant_url: "https://shop.example.com")
```

## What's in UCP

| Thing | What it does |
|-------|-------------|
| Checkout | Cart, line items, tax calc |
| Order | Order events — shipped, delivered, returned |
| Payment | Payment methods, tokenization |
| Fulfillment | Shipping options, delivery |

Plus extensions for discounts, buyer consent, and AP2 mandates.

## Dev

```bash
npm install
npm run build
npm start
```

## Links

- [UCP spec](https://ucp.dev)
- [UCP repo](https://github.com/Universal-Commerce-Protocol/ucp)
- [MCP docs](https://modelcontextprotocol.io)

## License

Apache-2.0
