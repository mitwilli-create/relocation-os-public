// Relocation KB MCP server: read-only, stdio, scoped to knowledge/ + tracked memory/.
// Three tools, all annotated read-only. No write or exec tools exist by construction.
//
// stdout is the MCP protocol channel: never write to it. Diagnostics go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchClaims, readClaim, listTopics } from "./kb.ts";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `error: ${message}` }], isError: true };
}

const server = new McpServer({ name: "relocation-kb", version: "0.1.0" });

server.registerTool(
  "search_claims",
  {
    title: "Search claims",
    description:
      "Lexical (ripgrep) search over the Relocation OS knowledge base (knowledge/ and tracked memory/). " +
      "Returns matching file, line number, and snippet. Read-only. Excludes memory/private. " +
      "The query is matched as a literal string, not a regex.",
    inputSchema: {
      query: z.string().min(1).max(512).describe("literal text to search for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("max results to return (default 20)"),
    },
    annotations: READ_ONLY,
  },
  async ({ query, limit }) => {
    try {
      const out = await searchClaims(query, limit ?? undefined);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "read_claim",
  {
    title: "Read claim",
    description:
      "Return one whole knowledge-base file byte-exact, given its repo-relative path (claim_id) " +
      "as reported by search_claims or list_topics. Read-only. Denies anything outside the served " +
      "scope or inside memory/private. The first content block is provenance; the second is the file.",
    inputSchema: {
      claim_id: z
        .string()
        .min(1)
        .describe("repo-relative path to a KB file, e.g. memory/constraints.md"),
    },
    annotations: READ_ONLY,
  },
  async ({ claim_id }) => {
    try {
      const out = await readClaim(claim_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ claim_id: out.claim_id, source: out.source, bytes: out.bytes }),
          },
          { type: "text", text: out.content },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "list_topics",
  {
    title: "List topics",
    description:
      "List the knowledge-base files available as claims (knowledge/ and tracked memory/), each with " +
      "its title and byte size. Read-only. Excludes memory/private.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  async () => {
    try {
      const topics = await listTopics();
      return {
        content: [{ type: "text", text: JSON.stringify({ count: topics.length, topics }, null, 2) }],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("relocation-kb MCP server: ready on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`relocation-kb MCP server: fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
