import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import JamClient from "jmap-jam";

import deno from "../deno.json" with { type: "json" };
import { registerEmailTools } from "./tools/email.ts";
import { registerEmailSubmissionTools } from "./tools/submission.ts";
import { formatError } from "./utils.ts";

const JMAPConfigSchema = z.object({
  sessionUrl: z.string().url().describe("JMAP server session URL"),
  bearerToken: z.string().min(1).describe("Bearer token for authentication"),
  accountId: z.string().optional().describe(
    "Account ID (will be auto-detected if not provided)",
  ),
});

const getJMAPConfig = () => {
  const sessionUrl = Deno.env.get("JMAP_SESSION_URL");
  const bearerToken = Deno.env.get("JMAP_BEARER_TOKEN");
  const accountId = Deno.env.get("JMAP_ACCOUNT_ID");

  if (!sessionUrl || !bearerToken) {
    throw new Error(
      "Missing required environment variables: JMAP_SESSION_URL and JMAP_BEARER_TOKEN",
    );
  }

  return JMAPConfigSchema.parse({
    sessionUrl,
    bearerToken,
    accountId,
  });
};

const createJAMClient = (config: z.infer<typeof JMAPConfigSchema>) => {
  return new JamClient({
    sessionUrl: config.sessionUrl,
    bearerToken: config.bearerToken,
  });
};

const createServer = async () => {
  const server = new McpServer({
    name: "jmap",
    version: deno.version,
    capabilities: {
      tools: {},
    },
    instructions:
      `This is a JMAP (JSON Meta Application Protocol) MCP server that provides comprehensive email management capabilities through JMAP-compliant email servers.

**Available Tools:**

**Email Search & Retrieval:**
- \`search_emails\`: Search emails with filters (text queries, sender/recipient, date ranges, keywords, mailbox filtering). Supports pagination.
- \`get_emails\`: Retrieve specific emails by ID with full details including headers, body, and attachments.
- \`get_threads\`: Get email conversation threads by ID.

**Mailbox Management:**
- \`get_mailboxes\`: List mailboxes/folders with hierarchy support and pagination.

**Email Actions (when not read-only):**
- \`mark_emails\`: Mark emails as read/unread or flagged/unflagged.
- \`move_emails\`: Move emails between mailboxes.
- \`delete_emails\`: Delete emails permanently (irreversible).

**Email Composition (when not read-only or submission capabilities are not supported):**
- \`send_email\`: Compose and send new emails with support for plain text, HTML, CC/BCC recipients.
- \`reply_to_email\`: Reply to existing emails with reply-all support and proper threading.

**Usage Guidelines:**
- All tools use pagination - use \`position\` parameter for large result sets
- Email search supports complex filters including keywords like '$seen', '$flagged', '$draft'
- Thread operations maintain conversation context and proper email references
- Send/reply operations require either textBody or htmlBody (or both)
- Date filters use ISO 8601 format (e.g., '2024-01-15T10:00:00Z')

**JMAP Compatibility:**
Works with any JMAP-compliant email server including Cyrus IMAP, Stalwart Mail Server, FastMail, and Apache James. The server automatically detects capabilities and adapts functionality accordingly.`,
  });

  const config = getJMAPConfig();
  const jam = createJAMClient(config);
  const accountId = config.accountId || await jam.getPrimaryAccount();
  const session = await jam.session;
  const account = session.accounts[accountId];

  if ("urn:ietf:params:jmap:mail" in session.capabilities) {
    registerEmailTools(
      server,
      jam,
      accountId,
      account.isReadOnly,
      getJMAPConfig,
      createJAMClient,
    );
    console.warn("Registered urn:ietf:params:jmap:mail tools");

    if (
      "urn:ietf:params:jmap:submission" in session.capabilities &&
      !account.isReadOnly
    ) {
      registerEmailSubmissionTools(server, jam, accountId);
      console.warn("Registered urn:ietf:params:jmap:submission tools");
    } else {
      console.warn(
        "JMAP mail submission capabilities not supported or is read only, email submission tools will not be available",
      );
    }
  } else {
    throw new Error(
      "JMAP mail capabilities not supported but required for this server",
    );
  }

  return server;
};

const main = async () => {
  const transport = new StdioServerTransport();

  let server: McpServer;
  try {
    server = await createServer();
  } catch (error) {
    console.error("JMAP connection failed:", formatError(error));
    console.error(
      "Please check your JMAP_SESSION_URL and JMAP_BEARER_TOKEN environment variables.",
    );
    Deno.exit(1);
  }

  await server.connect(transport);
  console.warn("JMAP MCP Server running on stdio");
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    Deno.exit(1);
  });
}
