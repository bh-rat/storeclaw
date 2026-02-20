---
name: gemini
description: Gemini CLI for one-shot Q&A, summaries, generation, and image creation/editing via Flash.
homepage: https://ai.google.dev/
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini", "uv"], "env": ["GEMINI_API_KEY"] },
        "primaryEnv": "GEMINI_API_KEY",
        "install":
          [
            {
              "id": "brew-gemini",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
            {
              "id": "brew-uv",
              "kind": "brew",
              "formula": "uv",
              "bins": ["uv"],
              "label": "Install uv (brew)",
            },
          ],
      },
  }
---

# Gemini

Default model: **Flash** — fast and cost-effective. Use `--model` to override when you need a different model.

## Text (CLI)

- `gemini "Answer this question..."`
- `gemini --model gemini-2.5-flash "Prompt..."` (default)
- `gemini --model gemini-2.5-pro "Complex prompt..."` (when you need deeper reasoning)
- `gemini --output-format json "Return JSON"`

Extensions

- List: `gemini --list-extensions`
- Manage: `gemini extensions <command>`

## Image Generation & Editing

Use the bundled script with Gemini Flash for image generation and editing.

Generate

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "your image description" --filename "output.png"
```

Edit (single image)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "edit instructions" --filename "output.png" -i "/path/in.png"
```

Multi-image editing

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "combine these" --filename "output.png" -i img1.png -i img2.png
```

## Notes

- If CLI auth is required, run `gemini` once interactively and follow the login flow.
- `GEMINI_API_KEY` env var is required for image generation. Or set `skills.gemini.apiKey` / `skills.gemini.env.GEMINI_API_KEY` in `~/.openclaw/openclaw.json`.
- Use timestamps in filenames for images: `yyyy-mm-dd-hh-mm-ss-name.png`.
- The script prints a `MEDIA:` line for OpenClaw to auto-attach on supported chat providers.
- Do not read generated images back; report the saved path only.
- Avoid `--yolo` for safety.
