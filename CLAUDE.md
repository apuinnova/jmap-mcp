# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides JMAP (JSON Meta
Application Protocol) email management tools. It's built with Deno and
integrates with JMAP-compliant email servers like FastMail, Cyrus IMAP, and
Stalwart Mail Server.

## Development Commands

### Building and Running

- `deno task start` - Run the MCP server in development
- `deno task watch` - Run with file watching for development

### Testing Connection

- `deno run --allow-env --allow-net src/mod.ts` - Test JMAP server connection

### Required Environment Variables

```bash
JMAP_SESSION_URL="https://your-jmap-server.com/.well-known/jmap"
JMAP_BEARER_TOKEN="your-bearer-token"
JMAP_ACCOUNT_ID="account-id"  # Optional, auto-detected if not provided
```

## Architecture

### Core Structure

- **Entry point**: `src/mod.ts` - MCP server setup, JMAP client initialization,
  and tool registration
- **Tool modules**: `src/tools/` - Modular tool implementations
  - `email.ts` - Email search, retrieval, mailbox management, and basic
    operations
  - `submission.ts` - Email composition and sending (when JMAP submission
    capability is available)
- **Utilities**: `src/utils.ts` - Common utilities like error formatting

### Key Design Patterns

- **Functional programming style** - Functions are pure where possible, side
  effects are contained
- **Runtime validation** - All inputs validated with Zod schemas before
  processing
- **Capability-based registration** - Tools are registered based on JMAP server
  capabilities
- **Graceful degradation** - Server adapts to read-only accounts and limited
  JMAP capabilities

### JMAP Integration

- Uses `jmap-jam` client library for JMAP RFC 8620/8621 compliance
- Automatically detects account capabilities and registers appropriate tools
- Supports both read-only and full-access JMAP accounts
- Handles JMAP mail (`urn:ietf:params:jmap:mail`) and submission
  (`urn:ietf:params:jmap:submission`) capabilities

### Tool Categories

1. **Email Search & Retrieval**: `search_emails`, `get_emails`, `get_threads`
2. **Mailbox Management**: `get_mailboxes`
3. **Email Actions** (non-read-only): `mark_emails`, `move_emails`,
   `delete_emails`
4. **Email Composition** (submission capability): `send_email`, `reply_to_email`

## Development Guidelines

### Adding New Tools

1. Create Zod validation schemas for input parameters
2. Implement tool logic with proper error handling using `formatError()`
3. Register tools in appropriate module (`email.ts` vs `submission.ts`)
4. Tools should be registered conditionally based on JMAP capabilities

### Code Style

- Follow functional programming patterns throughout the codebase
- Use TypeScript types imported from `jmap-jam` for JMAP objects
- All external inputs must be validated with Zod schemas
- Error handling should use the `formatError()` utility
- Console output uses `console.warn()` for server status messages

### JMAP Considerations

- Email IDs and thread IDs are server-specific strings, not UUIDs
- Mailbox hierarchies use parent-child relationships via `parentId`
- Keywords like `$seen`, `$flagged`, `$draft` control email state
- Date filters must use ISO 8601 format
- Pagination is handled via `position` and `limit` parameters

## Security Notes

- Bearer tokens are provided via environment variables, never hardcoded
- No secrets are logged or exposed in MCP responses
- Input validation prevents injection attacks
- JMAP protocol provides built-in security through proper authentication
