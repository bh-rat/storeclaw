import { describe, expect, it } from "vitest";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import {
  businessProfileHasValues,
  isBusinessPlaceholder,
  loadBusinessProfileFromWorkspace,
  parseBusinessMarkdown,
  parseIdentityMarkdown,
  parseOwnerMarkdown,
} from "./identity-file.js";

describe("parseIdentityMarkdown", () => {
  it("ignores identity template placeholders", () => {
    const content = `
# IDENTITY.md - Who Am I?

- **Name:** *(pick something you like)*
- **Creature:** *(AI? robot? familiar? ghost in the machine? something weirder?)*
- **Vibe:** *(how do you come across? sharp? warm? chaotic? calm?)*
- **Emoji:** *(your signature - pick one that feels right)*
- **Avatar:** *(workspace-relative path, http(s) URL, or data URI)*
`;
    const parsed = parseIdentityMarkdown(content);
    expect(parsed).toEqual({});
  });

  it("parses explicit identity values", () => {
    const content = `
- **Name:** Samantha
- **Creature:** Robot
- **Vibe:** Warm
- **Emoji:** :robot:
- **Avatar:** avatars/openclaw.png
`;
    const parsed = parseIdentityMarkdown(content);
    expect(parsed).toEqual({
      name: "Samantha",
      creature: "Robot",
      vibe: "Warm",
      emoji: ":robot:",
      avatar: "avatars/openclaw.png",
    });
  });
});

describe("parseBusinessMarkdown", () => {
  it("parses a filled business profile", () => {
    const content = `
# BUSINESS.md - Your Business

- **Name:** Sharma Electronics
- **Type:** Electronics and mobile accessories shop
- **Location:** Rajwada area, Indore, MP
- **Hours:** 10am-8pm, Mon-Sat
`;
    const parsed = parseBusinessMarkdown(content);
    expect(parsed).toEqual({
      name: "Sharma Electronics",
      type: "Electronics and mobile accessories shop",
      location: "Rajwada area, Indore, MP",
      hours: "10am-8pm, Mon-Sat",
    });
  });

  it("ignores business template placeholders", () => {
    const content = `
- **Name:**
- **Type:** _(e.g. electronics shop, tiffin service, clothing store, general store)_
- **Location:** _(city, area, or address)_
- **Hours:** _(e.g. 10am-8pm, Mon-Sat)_
`;
    const parsed = parseBusinessMarkdown(content);
    expect(parsed).toEqual({});
  });

  it("parses minimal business info", () => {
    const content = `
- **Name:** Gupta Tiffin Service
`;
    const parsed = parseBusinessMarkdown(content);
    expect(parsed).toEqual({ name: "Gupta Tiffin Service" });
  });

  it("parses multilingual content", () => {
    const content = `
- **Name:** Raju ki Dukaan
- **Type:** General store
- **Location:** MG Road, Bhopal
`;
    const parsed = parseBusinessMarkdown(content);
    expect(parsed).toEqual({
      name: "Raju ki Dukaan",
      type: "General store",
      location: "MG Road, Bhopal",
    });
  });

  it("parses business profile with website", () => {
    const content = `
- **Name:** Sharma Electronics
- **Type:** Electronics and mobile accessories shop
- **Location:** Rajwada area, Indore, MP
- **Hours:** 10am-8pm, Mon-Sat
- **Website:** https://sharmaelectronics.in
`;
    const parsed = parseBusinessMarkdown(content);
    expect(parsed).toEqual({
      name: "Sharma Electronics",
      type: "Electronics and mobile accessories shop",
      location: "Rajwada area, Indore, MP",
      hours: "10am-8pm, Mon-Sat",
      website: "https://sharmaelectronics.in",
    });
  });

  it("parses business profile with website only", () => {
    const content = `
- **Name:** Test Shop
- **Website:** https://testshop.com
`;
    const parsed = parseBusinessMarkdown(content);
    expect(parsed).toEqual({
      name: "Test Shop",
      website: "https://testshop.com",
    });
  });
});

describe("parseOwnerMarkdown", () => {
  it("parses a filled owner profile", () => {
    const content = `
# OWNER.md - Business Owner

- **Name:** Vikram Sharma
- **Phone:** +91-9876543210
- **Language:** Multilingual
- **Timezone:** Asia/Kolkata
`;
    const parsed = parseOwnerMarkdown(content);
    expect(parsed).toEqual({
      name: "Vikram Sharma",
      phone: "+91-9876543210",
      language: "Multilingual",
      timezone: "Asia/Kolkata",
    });
  });

  it("parses auto-populated owner (phone only)", () => {
    const content = `
- **Name:**
- **Phone:** +91-9999999999
- **Language:**
- **Timezone:**
`;
    const parsed = parseOwnerMarkdown(content);
    expect(parsed).toEqual({ phone: "+91-9999999999" });
  });
});

describe("isBusinessPlaceholder", () => {
  it("detects template placeholder values", () => {
    expect(
      isBusinessPlaceholder(
        "_(e.g. electronics shop, tiffin service, clothing store, general store)_",
      ),
    ).toBe(true);
    expect(isBusinessPlaceholder("_(city, area, or address)_")).toBe(true);
    expect(isBusinessPlaceholder("_(e.g. 10am-8pm, Mon-Sat)_")).toBe(true);
  });

  it("does not flag real values", () => {
    expect(isBusinessPlaceholder("Sharma Electronics")).toBe(false);
    expect(isBusinessPlaceholder("Indore")).toBe(false);
    expect(isBusinessPlaceholder("10am-8pm")).toBe(false);
  });
});

describe("businessProfileHasValues", () => {
  it("returns false for empty profile", () => {
    expect(businessProfileHasValues({})).toBe(false);
  });

  it("returns true when name is set", () => {
    expect(businessProfileHasValues({ name: "Sharma Electronics" })).toBe(true);
  });

  it("returns true when any field is set", () => {
    expect(businessProfileHasValues({ location: "Indore" })).toBe(true);
  });

  it("returns true when website is set", () => {
    expect(businessProfileHasValues({ website: "https://example.com" })).toBe(true);
  });
});

describe("loadBusinessProfileFromWorkspace", () => {
  it("returns null when BUSINESS.md does not exist", async () => {
    const tempDir = await makeTempWorkspace("storeclaw-business-");
    expect(loadBusinessProfileFromWorkspace(tempDir)).toBeNull();
  });

  it("returns null for an empty template", async () => {
    const tempDir = await makeTempWorkspace("storeclaw-business-");
    await writeWorkspaceFile({
      dir: tempDir,
      name: "BUSINESS.md",
      content: `# BUSINESS.md - Your Business\n\n- **Name:**\n- **Type:**\n- **Location:**\n- **Hours:**\n`,
    });
    expect(loadBusinessProfileFromWorkspace(tempDir)).toBeNull();
  });

  it("reads a filled BUSINESS.md from workspace", async () => {
    const tempDir = await makeTempWorkspace("storeclaw-business-");
    await writeWorkspaceFile({
      dir: tempDir,
      name: "BUSINESS.md",
      content: `# BUSINESS.md\n\n- **Name:** Test Shop\n- **Type:** Clothing\n`,
    });
    const profile = loadBusinessProfileFromWorkspace(tempDir);
    expect(profile).toEqual({ name: "Test Shop", type: "Clothing" });
  });
});
