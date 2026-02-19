import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { discoverSystems } from "./discovery.js";

describe("discoverSystems", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "storeclaw-systems-test-"));
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test("returns empty array when systems/ directory does not exist", () => {
    const result = discoverSystems(tmpDir);
    expect(result).toEqual([]);
  });

  test("returns empty array when systems/ is empty", async () => {
    await fs.mkdir(path.join(tmpDir, "systems"));
    const result = discoverSystems(tmpDir);
    expect(result).toEqual([]);
  });

  test("discovers a valid system with new model format (store + rules)", async () => {
    const systemDir = path.join(tmpDir, "systems", "customer");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      `---
name: customer
description: Track customers and interactions.
model:
  store: customer.sqlite
  rules:
    - id: extract-contact
      match: "customer name, phone number"
      source: all
      processor: schemas/extract-contact.json
    - id: track-credit
      match: "credit, udhar, payment"
      source: sessions
      processor: schemas/extract-credit.json
controller:
  schemas: [schemas/extract-contact.json, schemas/extract-credit.json]
  workflows: [workflows/update.lobster]
views: [views/summary.md]
schedule:
  - {name: weekly-digest, cron: "0 9 * * 1", task: scripts/digest.md}
---

# Customer System

Instructions here.
`,
    );

    const result = discoverSystems(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("customer");
    expect(result[0].manifest.description).toBe("Track customers and interactions.");
    expect(result[0].manifest.model?.store).toBe("customer.sqlite");
    expect(result[0].manifest.model?.rules).toHaveLength(2);
    expect(result[0].manifest.model?.rules![0].id).toBe("extract-contact");
    expect(result[0].manifest.model?.rules![0].match).toBe("customer name, phone number");
    expect(result[0].manifest.model?.rules![0].source).toBe("all");
    expect(result[0].manifest.model?.rules![0].processor).toBe("schemas/extract-contact.json");
    expect(result[0].manifest.model?.rules![1].id).toBe("track-credit");
    expect(result[0].manifest.model?.rules![1].source).toBe("sessions");
    expect(result[0].manifest.controller?.schemas).toEqual([
      "schemas/extract-contact.json",
      "schemas/extract-credit.json",
    ]);
    expect(result[0].manifest.controller?.workflows).toEqual(["workflows/update.lobster"]);
    expect(result[0].manifest.views).toEqual(["views/summary.md"]);
    expect(result[0].manifest.schedule).toHaveLength(1);
    expect(result[0].modelDbPath).toBe(path.join(systemDir, "customer.sqlite"));
    expect(result[0].systemMdPath).toBe(path.join(systemDir, "SYSTEM.md"));
  });

  test("backward compat: discovers system with old state_files format", async () => {
    const systemDir = path.join(tmpDir, "systems", "legacy");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      `---
name: legacy
description: Legacy system with state_files.
model:
  state_files: [state.md]
---

# Legacy System
`,
    );

    const result = discoverSystems(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].manifest.model?.state_files).toEqual(["state.md"]);
    expect(result[0].manifest.model?.store).toBe("legacy.sqlite");
    expect(result[0].capabilities).toContain("model");
  });

  test("defaults store to <name>.sqlite when not specified", async () => {
    const systemDir = path.join(tmpDir, "systems", "orders");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      `---
name: orders
description: Track orders.
model:
  rules:
    - id: detect-order
      match: "order, delivery"
      processor: schemas/extract-order.json
---
`,
    );

    const result = discoverSystems(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].manifest.model?.store).toBe("orders.sqlite");
    expect(result[0].modelDbPath).toBe(path.join(systemDir, "orders.sqlite"));
  });

  test("skips system with no description", async () => {
    const systemDir = path.join(tmpDir, "systems", "empty");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      `---
name: empty
---

# Empty System
`,
    );

    const result = discoverSystems(tmpDir);
    expect(result).toEqual([]);
  });

  test("falls back to directory name when name is missing", async () => {
    const systemDir = path.join(tmpDir, "systems", "credit");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      `---
description: Track credit balances.
---

# Credit System
`,
    );

    const result = discoverSystems(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("credit");
  });

  test("discovers multiple systems sorted by name", async () => {
    for (const name of ["orders", "credit", "customer"]) {
      const dir = path.join(tmpDir, "systems", name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, "SYSTEM.md"),
        `---
name: ${name}
description: ${name} system.
---

# ${name}
`,
      );
    }

    const result = discoverSystems(tmpDir);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.name)).toEqual(["credit", "customer", "orders"]);
  });

  test("computes capabilities correctly", async () => {
    // System with only model (store)
    const creditDir = path.join(tmpDir, "systems", "credit");
    await fs.mkdir(creditDir, { recursive: true });
    await fs.writeFile(
      path.join(creditDir, "SYSTEM.md"),
      `---
name: credit
description: Track credit.
model:
  store: credit.sqlite
---
`,
    );

    // System with all capabilities
    const customerDir = path.join(tmpDir, "systems", "customer");
    await fs.mkdir(customerDir, { recursive: true });
    await fs.writeFile(
      path.join(customerDir, "SYSTEM.md"),
      `---
name: customer
description: Track customers.
model:
  store: customer.sqlite
  rules:
    - id: extract-contact
      match: "customer name"
      processor: schemas/extract.json
controller:
  schemas: [schemas/extract.json]
  workflows: [workflows/update.lobster]
  scripts: [scripts/digest.md]
views: [views/summary.md]
schedule:
  - {name: digest, cron: "0 9 * * 1", task: scripts/digest.md}
---
`,
    );

    const result = discoverSystems(tmpDir);
    const credit = result.find((s) => s.name === "credit")!;
    const customer = result.find((s) => s.name === "customer")!;

    expect(credit.capabilities).toEqual(["model"]);
    expect(customer.capabilities).toEqual([
      "model",
      "schemas",
      "workflows",
      "scripts",
      "views",
      "schedule",
    ]);
  });

  test("skips directories without SYSTEM.md", async () => {
    const systemDir = path.join(tmpDir, "systems", "incomplete");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(path.join(systemDir, "state.md"), "# State");

    const result = discoverSystems(tmpDir);
    expect(result).toEqual([]);
  });

  test("skips files without frontmatter", async () => {
    const systemDir = path.join(tmpDir, "systems", "nofrontmatter");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      "# Just a heading\n\nNo frontmatter here.",
    );

    const result = discoverSystems(tmpDir);
    expect(result).toEqual([]);
  });

  test("skips rules with missing required fields", async () => {
    const systemDir = path.join(tmpDir, "systems", "badrules");
    await fs.mkdir(systemDir, { recursive: true });
    await fs.writeFile(
      path.join(systemDir, "SYSTEM.md"),
      `---
name: badrules
description: System with invalid rules.
model:
  store: badrules.sqlite
  rules:
    - id: valid-rule
      match: "test pattern"
      processor: schemas/test.json
    - id: missing-processor
      match: "incomplete"
---
`,
    );

    const result = discoverSystems(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].manifest.model?.rules).toHaveLength(1);
    expect(result[0].manifest.model?.rules![0].id).toBe("valid-rule");
  });
});
