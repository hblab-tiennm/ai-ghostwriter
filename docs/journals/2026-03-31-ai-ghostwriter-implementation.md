# AI Personal Ghostwriter (FUTA Land) — implementation recap

**Date**: 2026-03-31 23:34
**Severity**: Medium
**Component**: mcp-server / dataset / embedding pipeline
**Status**: Ongoing

## What Happened

Planned and implemented the initial MVP for an AI Personal Ghostwriter targeted at FUTA Land (BĐS). Chose a local, low-cost runtime (Claude Code CLI + MCP stdio) and built a TypeScript MCP server plus one-time embedding tooling. npm run build reported 0 TypeScript errors.

Key artifacts created:
- mcp-server/ (MCP tools: search_style_examples, get_style_rules, add_post)
- mcp-server/src/services/{chroma-service,embedding-service,style-rules}.ts
- scripts/embed-dataset.ts (upsert-safe)
- .claude/skills/ghostwriter/SKILL.md
- .claude/mcp.json (absolute paths)
- .claude/setup-mcp-config.sh

Dataset note: dataset present but imbalanced — 1 facebook_post, 50 news articles.

## The Brutal Truth

This is satisfying work but slightly sloppy: I shipped the code without running the embedding/indexing step because I didn’t have OPENAI_API_KEY available locally. That means the system is code-complete but not integrated — effectively a developer preview, not a runnable demo. It’s annoying and avoidable.

## Technical Details

- Build: npm run build → "Found 0 errors." (TypeScript OK)
- Embeddings: planned OpenAI text-embedding-3-small (cheaper, aimed at Vietnamese). scripts/embed-dataset.ts is written but not executed — requires OPENAI_API_KEY in .env
- Vector DB: ChromaDB used (SQLite-backed) to avoid Postgres/pgvector setup
- Search: vector search with sub_type filter + fallback to sub_type-only search when vectors sparse
- Static style rules: style-rules.ts contains configs for 8 sub_types (KISS)

## What We Tried

- Considered Postgres + pgvector but rejected because of setup overhead for MVP
- Tried to rely fully on vector fallback; added explicit sub_type fallback after seeing dataset sparsity
- Wrote upsert-safe embed script rather than ad-hoc re-index to avoid accidental dupes

## Root Cause Analysis

Why not fully runnable: missing API credentials (OPENAI_API_KEY) prevented running scripts/embed-dataset.ts and an end-to-end test. Also underestimated dataset imbalance (1 FB post vs 50 news) which forces us to rely on sub_type fallback.

## Lessons Learned

- Don't treat "build passes" as "integration passes" — run end-to-end with real creds before calling a feature complete.
- For small corpora expect sparsity; design search with deterministic metadata fallback (we did this, but it should have been flagged earlier).
- Absolute paths in .claude/mcp.json were necessary because Claude Code spawns from different CWDs — note this requirement in README.
- Keep at least 3 exemplar items per sub_type in the dataset before depending on vector-only retrieval.

## Next Steps (actionable)

1. Run embed-dataset.ts with OPENAI_API_KEY in .env. Owner: Tom. Timeline: within 24h.
2. End-to-end integration test (MCP server + Claude Code local run). Owner: Tom. Timeline: after embedding completes (within 48h).
3. Add CI check: fail build if embed step not executed or if dataset has sub_types with <3 examples. Owner: DevOps / Tom. Timeline: next sprint.
4. Balance dataset: add 2–4 facebook_post examples. Owner: Content / Tom. Timeline: 3 days.

## Unresolved Questions

- Do we want to store embeddings in a managed DB for scale, or keep Chroma (SQLite) for now? (trade-offs documented; decision deferred)
- Who will provide additional facebook_post examples? (need owner)



**Status:** DONE_WITH_CONCERNS
**Summary:** Code and architecture implemented; build clean. Blocker: embeddings/indexing and E2E tests pending due to missing API key.
**Concerns/Blockers:** dataset sparsity, missing OPENAI_API_KEY
