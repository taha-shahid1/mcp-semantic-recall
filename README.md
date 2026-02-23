# MCP Semantic Recall

[![npm version](https://img.shields.io/npm/v/mcp-semantic-recall.svg)](https://www.npmjs.com/package/mcp-semantic-recall)
[![npm downloads](https://img.shields.io/npm/dm/mcp-semantic-recall.svg)](https://www.npmjs.com/package/mcp-semantic-recall)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Semantic memory for AI coding agents using LanceDB and vector embeddings. Works with any MCP-compatible client.

## Features

- **Hybrid Search**: Combines vector similarity with keyword matching for better results
- **Auto-detection**: Uses Ollama if available, falls back to Transformers.js
- **Usage Tracking**: Optionally boost frequently accessed memories
- **Project Scoping**: Organize memories by project with tags
- **Persistent Storage**: All data stored locally in `~/.mcp-semantic-recall/`

## Quick Start

```bash
npx -y mcp-semantic-recall
```

Or add to your MCP client config:

```json
{
  "mcpServers": {
    "semantic-recall": {
      "command": "npx",
      "args": ["-y", "mcp-semantic-recall"]
    }
  }
}
```

Refer to your MCP client's documentation for config file location.

## Installation

### Global Installation (Optional)

```bash
npm install -g mcp-semantic-recall
```

Then use `mcp-semantic-recall` as the command instead of `npx`.

## Available Tools

### `add_memory`

Store a single memory with vector embeddings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | The content to remember (~250 words max, keep atomic) |
| `metadata.project` | string | No | Project path (e.g., `/Users/name/projects/myapp`) |
| `metadata.tags` | string[] | No | Tags for categorization |

**Example:**
```javascript
{
  "content": "Auth uses JWT tokens with 15min expiry. Refresh tokens in httpOnly cookies.",
  "metadata": {
    "project": "/Users/taha/projects/myapp",
    "tags": ["auth", "security", "jwt"]
  }
}
```

### `add_memories`

Store multiple memories at once with optional default metadata. Embeddings are generated in parallel for better performance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memories` | array | Yes | Array of memory objects with `content`, optional `project`, `tags` |
| `default_project` | string | No | Default project for all memories |
| `default_tags` | string[] | No | Default tags for all memories |

**Example:**
```javascript
{
  "default_project": "/Users/taha/projects/myapp",
  "default_tags": ["session-2026-02-22"],
  "memories": [
    {
      "content": "Auth uses JWT tokens with 15min expiry",
      "tags": ["auth", "jwt"]
    },
    {
      "content": "Database is PostgreSQL with Prisma ORM",
      "tags": ["database"]
    },
    {
      "content": "Tests use vitest framework"
    }
  ]
}
```

### `search_memories`

Search for memories using hybrid vector + keyword search.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |
| `limit` | number | No | Max results to return (default: 10) |
| `boost_frequent` | boolean | No | Boost frequently-accessed memories (default: false) |

**Example:**
```javascript
{
  "query": "how did we handle authentication",
  "limit": 5,
  "boost_frequent": true
}
```

### `get_related_memories`

Find memories semantically similar to a given memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memory_id` | string | Yes | ID of the memory to find related memories for |
| `limit` | number | No | Max results (default: 5) |
| `boost_frequent` | boolean | No | Boost frequently-accessed memories (default: false) |

**Example:**
```javascript
{
  "memory_id": "abc-123-def",
  "limit": 5
}
```

### `list_memories`

List memories with optional filtering and pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | No | Filter by project path |
| `tags` | string[] | No | Filter by tags (matches ANY tag) |
| `limit` | number | No | Max results (default: 50, max: 100) |
| `offset` | number | No | Pagination offset (default: 0) |

**Example:**
```javascript
{
  "project": "/Users/taha/projects/myapp",
  "tags": ["auth", "security"],
  "limit": 20
}
```

### `update_memory`

Update an existing memory's content or metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memory_id` | string | Yes | ID from search/list results |
| `content` | string | No | New content (regenerates embeddings) |
| `metadata.project` | string | No | Updated project path |
| `metadata.tags` | string[] | No | Updated tags |

**Example:**
```javascript
{
  "memory_id": "abc-123-def",
  "content": "Updated auth implementation...",
  "metadata": {
    "tags": ["auth", "security", "updated"]
  }
}
```

### `delete_memory`

Permanently delete a memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memory_id` | string | Yes | ID of memory to delete |

## Examples

### Tracking Architecture Decisions

```javascript
{
  "content": "Chose PostgreSQL over MongoDB for user data. Reasons: need ACID for payments, strong JSON support covers flexible fields, team knows Postgres better.",
  "metadata": {
    "project": "/Users/taha/projects/ecommerce",
    "tags": ["architecture", "database", "decision"]
  }
}
```

### Documenting API Patterns

```javascript
{
  "content": "API pagination uses cursor-based format: ?cursor=xyz&limit=50. Cursors expire after 24h. Implementation in src/api/pagination.ts",
  "metadata": {
    "project": "/Users/taha/projects/api-v2",
    "tags": ["api", "pagination"]
  }
}
```

### Bug Notes

```javascript
{
  "content": "WebSocket memory leak fixed by calling cleanup() in useEffect return. See commit abc123. Monitoring heap in prod.",
  "metadata": {
    "project": "/Users/taha/projects/chat-app",
    "tags": ["bug", "websocket", "fixed"]
  }
}
```

Search later:

```javascript
{
  "query": "database decisions",
  "limit": 5
}
```

## How It Works

### Embedding Providers

The server automatically detects the best embedding provider:

1. **Ollama** (preferred): Uses `nomic-embed-text` model (768 dimensions)
2. **Transformers.js** (fallback): Uses `Xenova/all-MiniLM-L6-v2` (384 dimensions)

### Hybrid Search

Searches combine:
- **Vector similarity**: Semantic meaning via embeddings
- **Keyword matching**: Full-text search on content
- **Usage boost**: Optionally prioritize frequently accessed memories

### Data Storage

All memories stored in `~/.mcp-semantic-recall/` using LanceDB:
- Persistent across sessions
- Automatic schema validation
- Efficient vector indexing

## Optional: Enhanced Embeddings with Ollama

For higher quality embeddings (768-dim vs 384-dim):

```bash
# Install Ollama (macOS)
brew install ollama

# Or download from https://ollama.com for other platforms

# Start Ollama
ollama serve

# In another terminal, pull the embedding model
ollama pull nomic-embed-text
```

The server will auto-detect Ollama on startup and use it if available.

## Best Practices

### Memory Atomicity

Keep memories focused and atomic (~250 words max):

**Good:**
```
Auth uses JWT tokens with 15min expiry. Refresh tokens stored in httpOnly cookies. 
Decided this over sessions for scalability.
```

**Bad:**
```
Here is our entire authentication system implementation covering login, logout, 
refresh, middleware, error handling, database schema, API endpoints... [500+ words]
```

If you need more detail, create multiple related memories.

### Project Organization

Use consistent project paths:

```javascript
// Use actual directory paths
"project": "/Users/taha/projects/myapp"

// Not custom strings
"project": "myapp"  // ❌
```

### Tagging Strategy

Use descriptive, consistent tags:

```javascript
"tags": ["auth", "jwt", "security"]  // ✅
"tags": ["stuff", "todo", "misc"]    // ❌
```

## Troubleshooting

### Server not appearing in MCP client

1. Check config file syntax (must be valid JSON)
2. Verify `npx` is in your PATH: `which npx`
3. Restart your MCP client completely
4. Check client logs for error messages

### Permission errors

```bash
# macOS/Linux - fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Ollama connection issues

Verify Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

If not running:

```bash
ollama serve
```

### Database errors

If you encounter schema errors after updating:

```bash
# Backup existing data
mv ~/.mcp-semantic-recall ~/.mcp-semantic-recall.backup

# Start fresh
# The server will recreate the database on next run
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## Links

- **GitHub**: https://github.com/taha-shahid1/mcp-semantic-recall
- **npm**: https://www.npmjs.com/package/mcp-semantic-recall
- **Issues**: https://github.com/taha-shahid1/mcp-semantic-recall/issues
