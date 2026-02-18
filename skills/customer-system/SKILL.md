---
name: customer-system
description: Reference guide for building customer tracking systems. Consult this when creating or evolving a customer system in systems/customer/.
metadata: { "openclaw": { "emoji": "👥" } }
---

# Customer System Reference

This is a **reference skill** — not an active system. Consult it when building or evolving a customer tracking system.

## Example SYSTEM.md

```yaml
---
name: customer
description: Track customers, preferences, interactions, and credit from conversations. Activate when customer names, phone numbers, orders, or credit amounts are mentioned.
model:
  state_files: [state.md]
controller:
  schemas: [schemas/extract.json]
  workflows: [workflows/update-contact.lobster]
  scripts: [scripts/weekly-digest.md]
views: [views/summary.md, views/report.md]
schedule:
  - name: weekly-customer-digest
    cron: "0 9 * * 1"
    task: scripts/weekly-digest.md
---

# Customer System

## When to Activate

Activate when the conversation mentions:
- Customer names (new or existing)
- Phone numbers or contact details
- Orders, purchases, or transactions
- Credit amounts (udhar) or payments
- Customer preferences or complaints

## Extraction

Use `llm-task` with `schemas/extract.json` to extract structured customer data from the message.

## State Updates

1. Read `state.md`
2. Find existing entry by name (fuzzy match) or phone number
3. If found: update the entry with new information
4. If new: append a new entry at the end
5. Write back `state.md`

Never delete entries. Append interaction history.

## Presentation

When asked about a customer, use `views/summary.md` template.
When asked for a report, use `views/report.md` template.

## Language

Detect the user's language and respond in the same language. Don't fabricate information — only report what's in state.md.
```

## Example state.md

```markdown
# Customers

## Sharma-ji

- **Phone:** +91 98765 43210
- **Since:** 2024-01
- **Preferences:** Prefers delivery before 10am, always orders atta and dal
- **Credit:** ₹2,400 outstanding
- **Last interaction:** 2024-03-15 — ordered 5kg atta, 2kg dal

## Priya Mehta

- **Phone:** +91 87654 32109
- **Since:** 2024-02
- **Preferences:** Vegetarian, prefers organic products
- **Credit:** ₹0
- **Last interaction:** 2024-03-14 — inquired about organic ghee availability
```

## Example schemas/extract.json

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Customer name as mentioned in conversation"
    },
    "phone": {
      "type": "string",
      "description": "Phone number if mentioned"
    },
    "interactionType": {
      "enum": ["order", "payment", "inquiry", "complaint"],
      "description": "Type of customer interaction"
    },
    "amount": {
      "type": "number",
      "description": "Transaction amount if mentioned"
    },
    "notes": {
      "type": "string",
      "description": "Additional context from the conversation"
    }
  },
  "required": ["name"]
}
```

## Example workflows/update-contact.lobster

```
extract-customer
  | validate-data
  | approve "Update customer record for {{name}}?"
  | write-state
  | confirm "Updated {{name}}'s record."
```

Pipeline steps:

1. **extract-customer** — use `llm-task` with `schemas/extract.json`
2. **validate-data** — check required fields, normalize phone format
3. **approve** — ask the owner before writing (Lobster approval gate)
4. **write-state** — update `state.md` with extracted data
5. **confirm** — reply with confirmation message

## Example views/summary.md

```markdown
# Customer Summary Template

When presenting a customer summary, format as:

**{{name}}**
📱 {{phone}}
📅 Customer since {{since}}
💬 {{preferences}}
💰 Credit: {{credit}}
🕐 Last: {{lastInteraction}}
```

## Example Cron Schedule

Declared in SYSTEM.md frontmatter:

```yaml
schedule:
  - name: weekly-customer-digest
    cron: "0 9 * * 1"
    task: scripts/weekly-digest.md
```

### scripts/weekly-digest.md

```markdown
# Weekly Customer Digest

1. Read `state.md`
2. Find all customers with interactions in the past 7 days
3. Summarize: total interactions, new customers, outstanding credit
4. Format using `views/report.md`
5. Deliver to the owner
```

## Rules

- **Don't fabricate** — only report data from state.md
- **Append, don't overwrite** — new interactions get added, never replace history
- **Detect language** — match the owner's language (Hindi, English, mixed)
- **Fuzzy match names** — "Sharma ji", "Sharma-ji", "sharma" are the same person
- **Normalize phone numbers** — strip spaces/dashes, ensure country code
