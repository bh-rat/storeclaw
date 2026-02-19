---
summary: "Dev agent AGENTS.md (StoreClaw business)"
read_when:
  - Using the dev gateway templates
  - Updating the default dev agent identity
---

# AGENTS.md - StoreClaw Dev Workspace

This folder is the dev business workspace for testing StoreClaw.

## First run (one-time)

- If BOOTSTRAP.md exists, follow its onboarding script and delete it once complete.
- Business profile lives in BUSINESS.md (pre-filled: Sharma Electronics).
- Owner profile lives in OWNER.md.
- Agent identity lives in IDENTITY.md.
- User profile lives in USER.md.

## Every session

1. Read SOUL.md, BUSINESS.md, OWNER.md, TEAM.md
2. Read IDENTITY.md and USER.md if they exist
3. Read today + yesterday's memory files if present

## Backup tip (recommended)

If you treat this workspace as the agent's "memory", make it a git repo (ideally private) so business data and notes are backed up.

## Safety defaults

- Don't exfiltrate business data or secrets.
- Don't run destructive commands unless explicitly asked.
- Be concise in chat; write longer output to files in this workspace.

## Daily memory (recommended)

- Keep a short daily log at memory/YYYY-MM-DD.md (create memory/ if needed).
- On session start, read today + yesterday if present.
- Capture business facts, preferences, and decisions; avoid secrets.

## Heartbeats (optional)

- HEARTBEAT.md can hold a tiny checklist for heartbeat runs; keep it small.

## Progressive learning

- Update BUSINESS.md, OWNER.md, TEAM.md as you learn new facts

## Systems Testing

Test the storeclaw-systems plugin by creating systems in this dev workspace.

### Minimal test system

Create `systems/test/SYSTEM.md` with minimal frontmatter:

```markdown
---
name: test
description: A test system for verifying discovery and injection.
model:
  store: test.sqlite
  rules:
    - id: test-rule
      match: "test data, sample input"
      source: all
      processor: schemas/extract.json
---

# Test System

When activated, use memory_search with the rule match pattern to find relevant data. Use system_model tool to track source references and processing state.
```

Start the gateway and verify `<active_systems>` appears in agent context with `<model_status>` information.

### Full example test

1. Create a customer system at `systems/customer/` with SYSTEM.md (including model.store and model.rules), schemas/extract-contact.json, and views/summary.md
2. Send a message mentioning a customer name
3. Verify the agent reads SYSTEM.md, uses the schema for extraction via `llm-task`
4. Verify `system_model` tool is available — test `status`, `add_ref`, `process`, and `query` actions
5. Verify `processing.jsonl` audit log gets written
6. Test views: ask for a customer summary and verify it uses views/summary.md formatting
7. Verify `<model_status>`, `<controller_hint>`, `<extraction_hint>`, and `<view_hint>` appear in the injected context

### Verify injection

- Check gateway logs for `storeclaw-systems: injecting N system(s) into context`
- Confirm `<active_systems>` XML block appears in the system prompt
- Verify systems without descriptions are skipped
- Verify the maxSystems cap is respected
- Verify `<model_status>` shows pending/processed counts for systems with SQLite DBs

## Customize

- Add your preferred style, rules, and "memory" here.
