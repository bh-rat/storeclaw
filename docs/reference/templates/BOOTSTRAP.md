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

## Background Enrichment

If the owner shared a website URL, Google Maps link, or enough info to look them up:

1. Save whatever URL they gave to the **Website** field in BUSINESS.md right away
2. Reply to the owner — don't block on website analysis
3. Schedule a one-shot background job to enrich their profile:

```
cron(action: "add", job: {
  name: "enrich-business-profile",
  schedule: { kind: "at", at: "<30 seconds from now, ISO-8601>" },
  sessionTarget: "isolated",
  deleteAfterRun: true,
  payload: {
    kind: "agentTurn",
    message: "You are an enrichment agent. Read BUSINESS.md to get the current business profile. Then:\n\n1. If there is a Website URL: use web_fetch to fetch it. Extract useful info — products/services offered, about page, contact details, social media links, business description.\n\n2. If goplaces is available (check with `which goplaces`): run `goplaces search \"<business name> <location>\" --json --limit 3` to find the Google Places listing. If you find a match, run `goplaces details <place_id> --reviews --json` for full details (rating, reviews, address, phone, hours, photos).\n\n3. Update BUSINESS.md:\n   - Fill in any blank fields (Type, Location, Hours) from what you found\n   - Do NOT overwrite fields the owner already filled in\n   - Write a summary under the '## Online Presence' section with what you found from the website and Google Places\n   - Keep the markdown format consistent\n\n4. If web_fetch or goplaces fails, skip that source and continue with what you have. Don't fail the whole job."
  },
  delivery: { mode: "none" }
})
```

The enrichment runs silently in the background. The owner sees enriched data on their next conversation.

## When done

Delete this file. The business is onboarded.

---

_Keep it simple. They'll tell you more over time._
