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

## How It Works

Server auto-detects:
- Ollama (nomic-embed-text) if available
- Falls back to Transformers.js (all-MiniLM-L6-v2)

Data stored in `~/.mcp-semantic-recall/`

## Tools

- `add_memory` - Store memory with embeddings (~250 word limit, keep atomic)
- `search_memories` - Hybrid vector + keyword search with frequency boost
- `list_memories` - Browse memories by project/tags with pagination
- `update_memory` - Update existing memory content/metadata
- `delete_memory` - Remove memory by ID

## Optional: Better Embeddings with Ollama

For higher quality embeddings:

```bash
# Install Ollama
brew install ollama

# Start Ollama
ollama serve

# In another terminal, pull the model
ollama pull nomic-embed-text
```
