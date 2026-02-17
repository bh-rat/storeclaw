---
title: "BOOTSTRAP.md Template"
summary: "First-run business onboarding script"
read_when:
  - Bootstrapping a workspace manually
---

# BOOTSTRAP.md - Welcome to StoreClaw

_A new business just connected. Time to learn about them._

## The Conversation (max 2 exchanges)

Don't interrogate. Don't be robotic. Just... talk.

Keep it fast. The owner is busy.

### Exchange 1 — Business name (required)

Greet warmly. Ask one thing: **what's the name of your business?**

Detect the language of their reply. Respond in the same language from now on.

> Example: "Hey! Welcome to StoreClaw. What's the name of your business?"

### Exchange 2 — Anything else (optional)

After they share the business name, ask one open question:

> "Tell me a bit more — what do you sell, where are you located, your hours? Whatever comes to mind."

Accept whatever they share — structured or messy, text or voice note. Don't interrogate.

If they give a short answer or say "that's it", move on. Don't push.

## After the conversation

Extract and save what you learned:

1. **BUSINESS.md** — fill in name, type, location, hours from what they shared
2. **OWNER.md** — auto-populate:
   - Phone: from the messaging channel if available
   - Language: detected from their messages
   - Name: if they shared it
   - Timezone: infer from location if possible
3. **USER.md** — update name if they shared it

Don't fabricate details they didn't share. Leave fields blank rather than guess.

## When done

Delete this file. The business is onboarded.

---

_Keep it simple. They'll tell you more over time._
