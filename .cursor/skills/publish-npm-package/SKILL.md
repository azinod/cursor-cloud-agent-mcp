---
name: publish-npm-package
description: Use when publishing or republishing this repository's npm package, especially for npx-based MCP startup verification.
---

# Publish NPM Package

Use this skill for publishing `@azinod/cursor-cloud-agent-mcp`.

## Pre-Publish Checklist

1. Confirm the working tree only contains intended release changes.
2. Confirm the version is already bumped in `package.json`.
3. Check npm auth:
   - `npm whoami`
4. Build and inspect the artifact:
   - `NODE_TLS_REJECT_UNAUTHORIZED=1 npm run build`
   - `NODE_TLS_REJECT_UNAUTHORIZED=1 npm pack --dry-run`
   - `NODE_TLS_REJECT_UNAUTHORIZED=1 npm pack`
5. Smoke test the tarball through the same path `npx` users rely on:
   - use a clean cache when possible, e.g. `NPM_CONFIG_CACHE=/tmp/...`
   - start the tarball with `npx -y ./azinod-cursor-cloud-agent-mcp-<version>.tgz`
   - run one real MCP probe such as `list_models`

## Publish Command

Use:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=1 npm publish --access public
```

If npm requires 2FA, rerun with:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=1 npm publish --access public --otp=<code>
```

## Post-Publish Verification

1. Verify registry metadata:
   - `npm view @azinod/cursor-cloud-agent-mcp version bin`
2. Clear temp npx cache if previous runs were corrupted:
   - `rm -rf ~/.npm/_npx`
3. Test the published package:
   - `CURSOR_API_KEY=... NODE_TLS_REJECT_UNAUTHORIZED=1 npx -y @azinod/cursor-cloud-agent-mcp`
4. Prefer one real MCP client call after publish, not just process startup.

## Repo-Specific Notes

- This package is a local `stdio` MCP server, not a hosted remote endpoint.
- `NODE_TLS_REJECT_UNAUTHORIZED=1` should be set explicitly during publish and verification because this machine has previously leaked `=0` into npm and MCP child processes.
- If `npx` fails but a global install works, treat that as an npm cache/runtime issue and verify with a clean cache before blaming the package.
