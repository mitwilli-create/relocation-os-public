# relocation-kb MCP server

A scoped, read-only Model Context Protocol server that exposes the Relocation OS
knowledge base (`knowledge/` and tracked `memory/`) so sessions retrieve claims
through tool calls instead of loading whole files into context.

Design and security rationale: [ADR-0005](../../docs/decisions/ADR-0005-relocation-kb-mcp-server.md),
backed by the adjudicated council report at
`knowledge/research/2026-07-09-mcp-server-security-hardening-ADJUDICATED.md`.

## Tools (all read-only)

| Tool | Input | Returns |
|---|---|---|
| `search_claims` | `query` (literal string), `limit?` | matching file, line, snippet |
| `read_claim` | `claim_id` (repo-relative path) | one whole file, byte-exact, plus provenance |
| `list_topics` | none | the KB files available as claims, with title and size |

There are no write or exec tools. All three carry `readOnlyHint: true`.

## Scope and safety

- Scope is fixed at startup from the server's own location, never `process.cwd()`.
- Served set is an allowlist: `knowledge/` and `memory/`. Never the whole repo, never `$HOME`.
- `memory/private/` is denied in every code path, canonicalized with `fs.realpath` to defeat symlink escape.
- Search shells nothing: ripgrep runs via `execFile` against the absolute bundled binary
  (`@vscode/ripgrep`), with the query passed as `-e` data so a leading `-` cannot inject a flag.
- Transport is stdio, for a local single-user client. CVE-2026-30623 is a client/proxy config
  flaw; a self-authored server spawned by a trusted local client is not exposed to it.

## Requirements

Node 23.6 or newer (runs TypeScript directly via native type stripping, no build step).
Developed on Node 24.14.

## Install and run

```sh
cd mcp/relocation-kb
npm ci                 # or: npm install
npm start              # node src/index.ts, speaks MCP over stdio
```

## Tests

```sh
npm run selftest             # security + behavior invariants (gated in CI)
node test/probe-client.ts    # end-to-end: spawn server, list tools, exercise a denial
```

## Registration

- Claude Code: `.mcp.json` at the repo root (relative launch path; Claude Code sets cwd to the repo).
- Codex: `~/.codex/config.toml` under `[mcp_servers.relocation-kb]` (absolute launch path; not committed).

Both point at `src/index.ts`. Scope is anchored to the file location, so cwd does not affect it.
