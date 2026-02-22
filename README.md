# StoreClaw — Business Assistant for Micro Enterprises

<p align="center">
  <img src="docs/images/storeclaw-banner.png" alt="StoreClaw" width="420" />
</p>

**StoreClaw** is an attempt to build an agentic AI assistant for micro enterprises especially retail and ecommerce, powered by natural conversations.

<p align="center">
  <img src="https://img.shields.io/badge/Status-Early%20Stage-red?style=for-the-badge" alt="Early Stage">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

---

## Why

There are 200 million+ micro enterprises worldwide and 50 million of them already run on WhatsApp. They work — owners track credit in their heads, take orders via voice notes, and manage inventory by looking at shelves. Up to 95% of digital transformation projects fail because they ask people to stop doing what works and start using dashboards and forms instead. StoreClaw doesn't. It joins the conversations already happening and turns them into business intelligence — customers, orders, inventory, payments — without the owner doing anything differently.

## Direction

StoreClaw is completely built on OpenClaw — gateway, channels, sessions, memory, skills. The work ahead:

- [ ] **Business workspace** — replace personal assistant templates with business-oriented ones (`BUSINESS.md`, `OWNER.md`, `CONTACTS.md`, `PRODUCTS.md`) that grow organically from conversation
- [ ] **System observation** — the agent recognizes business patterns (credit, orders, customers) and tracks them without configuration
- [ ] **WhatsApp-first onboarding** — business name + optional free-text, under 60 seconds, no CLI
- [ ] **Operator → Owner workflow** — an operator pre-configures the platform (LLM routing, channel credentials, assistant personality, feature tiers) for a segment of businesses; the owner just messages on WhatsApp and starts using it — no technical setup
- [ ] **Local model integration** — regional AI providers for speech, vision, and language processing in local languages ([Sarvam AI](https://www.sarvam.ai/) for India, [Lelapa AI](https://lelapa.ai/) for Africa, [SeaLLM](https://github.com/DAMO-NLP-SG/SeaLLM) for Southeast Asia, [LATAM-GPT](https://huggingface.co/CENIA) for Latin America)

The `main` branch stays in sync with upstream OpenClaw. StoreClaw-specific work happens on the `storeclaw` branch.

---

Built on [OpenClaw](https://github.com/openclaw/openclaw). For setup, channels, and configuration, see the [OpenClaw docs](https://docs.openclaw.ai/start/getting-started).
