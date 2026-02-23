# mcp-semantic-recall

Semantic memory for AI coding agents using LanceDB and embeddings.

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
node dist/index.js
```

Server auto-detects:
- Ollama (nomic-embed-text) if available
- Falls back to Transformers.js (all-MiniLM-L6-v2)

Data stored in `~/.mcp-semantic-recall/`

## Tools

- `add_memory` - Store memory with embeddings
- `search_memories` - Vector search with optional frequency boost
- `update_memory` - Update content/metadata
- `delete_memory` - Delete by ID
