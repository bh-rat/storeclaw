import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBusinessSystemCreateTool, createBusinessSystemGetTool } from "./systems-tool.js";

describe("business_system_create", () => {
  const tmpDir = path.join("/tmp", "test-bsys-create-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates system directory, SYSTEM.md, and REGISTRY.md", async () => {
    const tool = createBusinessSystemCreateTool({ workspaceDir: tmpDir });
    const result = await tool.execute("call-1", {
      name: "crm",
      description: "Track customers and credit",
    });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const payload = JSON.parse(text);

    expect(payload.created).toBe("systems/crm/SYSTEM.md");
    expect(payload.nextSteps).toHaveLength(3);

    // SYSTEM.md exists with correct content
    const systemMd = fs.readFileSync(path.join(tmpDir, "systems/crm/SYSTEM.md"), "utf-8");
    expect(systemMd).toContain("name: crm");
    expect(systemMd).toContain("Track customers and credit");
    expect(systemMd).toContain("## Purpose");
    expect(systemMd).toContain("## Data Files");
    expect(systemMd).toContain("## How It Works");
    expect(systemMd).toContain("## Views");

    // REGISTRY.md exists with entry
    const registry = fs.readFileSync(path.join(tmpDir, "systems/REGISTRY.md"), "utf-8");
    expect(registry).toContain("# Business Systems");
    expect(registry).toContain("| crm | active | Track customers and credit |");
  });

  it("appends to existing REGISTRY.md", async () => {
    const tool = createBusinessSystemCreateTool({ workspaceDir: tmpDir });
    await tool.execute("call-1", { name: "crm", description: "CRM tracking" });
    await tool.execute("call-2", { name: "credit", description: "Udhar tracking" });

    const registry = fs.readFileSync(path.join(tmpDir, "systems/REGISTRY.md"), "utf-8");
    expect(registry).toContain("| crm | active | CRM tracking |");
    expect(registry).toContain("| credit | active | Udhar tracking |");
  });

  it("rejects duplicate system names", async () => {
    const tool = createBusinessSystemCreateTool({ workspaceDir: tmpDir });
    await tool.execute("call-1", { name: "crm", description: "First" });
    const result = await tool.execute("call-2", { name: "crm", description: "Second" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const payload = JSON.parse(text);

    expect(payload.error).toContain("already exists");
  });

  it("normalizes name to lowercase with hyphens", async () => {
    const tool = createBusinessSystemCreateTool({ workspaceDir: tmpDir });
    await tool.execute("call-1", { name: "Order Tracking", description: "Track orders" });

    expect(fs.existsSync(path.join(tmpDir, "systems/order-tracking/SYSTEM.md"))).toBe(true);
  });
});

describe("business_system_get", () => {
  const tmpDir = path.join("/tmp", "test-bsys-get-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns manifest and file list for an existing system", async () => {
    // Set up a system with SYSTEM.md and a data file
    const systemDir = path.join(tmpDir, "systems/crm");
    fs.mkdirSync(systemDir, { recursive: true });
    fs.writeFileSync(path.join(systemDir, "SYSTEM.md"), "# CRM\n\nTrack customers.\n");
    fs.writeFileSync(
      path.join(systemDir, "contacts.jsonl"),
      '{"name":"Sharma","phone":"9876543210"}\n{"name":"Gupta","phone":"9876543211"}\n',
    );

    const tool = createBusinessSystemGetTool({ workspaceDir: tmpDir });
    const result = await tool.execute("call-1", { name: "crm" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const payload = JSON.parse(text);

    expect(payload.system).toBe("crm");
    expect(payload.manifest).toContain("Track customers");
    expect(payload.files).toHaveLength(2);

    // Check JSONL introspection
    const jsonlFile = payload.files.find((f: { file: string }) => f.file.endsWith(".jsonl"));
    expect(jsonlFile).toBeDefined();
    expect(jsonlFile.preview).toContain("2 entries");
    expect(jsonlFile.preview).toContain("name");
    expect(jsonlFile.preview).toContain("phone");
  });

  it("introspects JSON files", async () => {
    const systemDir = path.join(tmpDir, "systems/config");
    fs.mkdirSync(systemDir, { recursive: true });
    fs.writeFileSync(path.join(systemDir, "SYSTEM.md"), "# Config\n");
    fs.writeFileSync(path.join(systemDir, "state.json"), '{"lastRun":"2026-02-20","count":42}');

    const tool = createBusinessSystemGetTool({ workspaceDir: tmpDir });
    const result = await tool.execute("call-1", { name: "config" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const payload = JSON.parse(text);

    const jsonFile = payload.files.find((f: { file: string }) => f.file.endsWith(".json"));
    expect(jsonFile).toBeDefined();
    expect(jsonFile.preview).toContain("lastRun");
    expect(jsonFile.preview).toContain("count");
  });

  it("returns error for missing system", async () => {
    const tool = createBusinessSystemGetTool({ workspaceDir: tmpDir });
    const result = await tool.execute("call-1", { name: "nonexistent" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    const payload = JSON.parse(text);

    expect(payload.error).toContain("not found");
  });
});
