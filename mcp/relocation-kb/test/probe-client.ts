// End-to-end MCP probe: spawn the server over stdio, list tools, and exercise one
// call of each plus a denial. Runtime-agnostic proof of what Claude Code and Codex
// will see. Run: node test/probe-client.ts   (from mcp/relocation-kb/)

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/index.ts"],
    cwd: serverDir,
  });
  const client = new Client({ name: "probe", version: "0.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  process.stdout.write("TOOLS: " + tools.map((t) => t.name).join(", ") + "\n");
  for (const t of tools) {
    process.stdout.write(`  ${t.name} readOnlyHint=${t.annotations?.readOnlyHint}\n`);
  }

  const topics = await client.callTool({ name: "list_topics", arguments: {} });
  const topicsText = (topics.content as Array<{ text?: string }>)[0]?.text ?? "";
  const topicsCount = JSON.parse(topicsText).count;
  process.stdout.write("list_topics count: " + topicsCount + "\n");

  const search = await client.callTool({
    name: "search_claims",
    arguments: { query: "Beckham", limit: 3 },
  });
  const searchText = (search.content as Array<{ text?: string }>)[0]?.text ?? "";
  const searchCount = JSON.parse(searchText).count;
  process.stdout.write("search_claims 'Beckham' count: " + searchCount + "\n");

  const denied = await client.callTool({
    name: "read_claim",
    arguments: { claim_id: "memory/private/personal-context.md" },
  });
  process.stdout.write(
    "read_claim private -> isError=" +
      denied.isError +
      " :: " +
      (denied.content as Array<{ text?: string }>)[0]?.text +
      "\n",
  );

  await client.close();

  if (
    tools.length !== 3 ||
    topicsCount < 1 ||
    typeof searchCount !== "number" ||
    searchCount < 1 ||
    !denied.isError
  ) {
    process.stdout.write("PROBE: FAIL\n");
    process.exit(1);
  }
  process.stdout.write("PROBE: PASS\n");
}

main().catch((err) => {
  process.stdout.write("PROBE: ERROR " + (err?.stack ?? err) + "\n");
  process.exit(1);
});
