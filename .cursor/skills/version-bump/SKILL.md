---
name: version-bump
description: Use when bumping this repository's npm package version before a release, republish, or package metadata change.
---

# Version Bump

Use this skill for `@azinod/cursor-cloud-agent-mcp` version bumps.

## Workflow

1. Read `package.json` and confirm the current version.
2. Check the latest published version:
   - `npm view @azinod/cursor-cloud-agent-mcp version`
3. Choose the next version:
   - `patch` for fixes, docs, packaging, or MCP schema/default tweaks
   - `minor` for new tools or meaningful new capabilities
   - `major` for breaking API/tool behavior changes
4. Update version metadata consistently:
   - Prefer `npm version <patch|minor|major> --no-git-tag-version`
   - If a manual version edit already happened, run `npm install` to refresh `package-lock.json`
5. Verify:
   - `npm run build`
   - confirm `package.json` and `package-lock.json` match

## Repo Rules

- Do not create a git tag unless the user explicitly asks.
- Do not publish as part of the version bump unless the user explicitly wants publish included.
- Keep version bumps separate from unrelated code changes when possible.

## Quick Checks

- Current local version: `package.json`
- Current published version: `npm view @azinod/cursor-cloud-agent-mcp version`
- Release readiness: `npm run build`
