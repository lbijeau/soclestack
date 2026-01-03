# SocleStack Documentation Engine Instructions

This file contains the persistent instructions for the AI agent to maintain the documentation site.

## General Principles
- **Tooling**: Use VitePress for the site, Mermaid for diagrams, and Tailwind colors (Granite/Electric Blue) for styling.
- **Syncing**: Always ensure root-level `.md` files are symlinked into `docs/`.
- **Primary Update Command**: `npm run docs:all` (runs TypeDoc, OpenAPI, and VitePress build).

## API Documentation (LLM-Driven)
When asked to "Update API Docs", follow this procedure:
1. Scan `src/app/api/` recursively.
2. For each route, identify:
   - HTTP Method and Endpoint path.
   - Required Body/Query parameters (via Zod schemas).
   - Expected Response (Success and Error types).
   - Authentication requirements (Middleware check).
3. Generate `docs/API_REFERENCE.md` with a structured table and code examples for each endpoint.

## API Specification (OpenAPI)
- **Generator**: `scripts/generate-openapi.ts`.
- **Process**: Extracts definitions from `src/lib/validations.ts` using `@asteasolutions/zod-to-openapi`.
- **Output**: `docs/public/openapi.json` and `docs/public/openapi.yaml`.
- **Maintenance**: Register new paths and schemas in the generator script to keep the spec in sync.

## Library Documentation (TypeDoc)
- **Tool**: TypeDoc with `typedoc-plugin-markdown`.
- **Config**: `typedoc.json`.
- **Target**: `src/lib/` and `src/types/`.
- **Output**: `docs/api-generated/`.

## Visual Standards
- Every major architecture update must include a Mermaid diagram.
- Use `erDiagram` for data and `sequenceDiagram` for flows.
- Theme overrides are in `docs/.vitepress/theme/custom.css`.
