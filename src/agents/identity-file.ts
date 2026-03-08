import fs from "node:fs";
import path from "node:path";
import { DEFAULT_IDENTITY_FILENAME } from "./workspace.js";

const DEFAULT_BUSINESS_FILENAME = "BUSINESS.md";

export type AgentIdentityFile = {
  name?: string;
  emoji?: string;
  theme?: string;
  creature?: string;
  vibe?: string;
  avatar?: string;
};

const IDENTITY_PLACEHOLDER_VALUES = new Set([
  "pick something you like",
  "ai? robot? familiar? ghost in the machine? something weirder?",
  "how do you come across? sharp? warm? chaotic? calm?",
  "your signature - pick one that feels right",
  "workspace-relative path, http(s) url, or data uri",
]);

function normalizeIdentityValue(value: string): string {
  let normalized = value.trim();
  normalized = normalized.replace(/^[*_]+|[*_]+$/g, "").trim();
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/[\u2013\u2014]/g, "-");
  normalized = normalized.replace(/\s+/g, " ").toLowerCase();
  return normalized;
}

function isIdentityPlaceholder(value: string): boolean {
  const normalized = normalizeIdentityValue(value);
  return IDENTITY_PLACEHOLDER_VALUES.has(normalized);
}

export function parseIdentityMarkdown(content: string): AgentIdentityFile {
  const identity: AgentIdentityFile = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = line.trim().replace(/^\s*-\s*/, "");
    const colonIndex = cleaned.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const label = cleaned.slice(0, colonIndex).replace(/[*_]/g, "").trim().toLowerCase();
    const value = cleaned
      .slice(colonIndex + 1)
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    if (!value) {
      continue;
    }
    if (isIdentityPlaceholder(value)) {
      continue;
    }
    if (label === "name") {
      identity.name = value;
    }
    if (label === "emoji") {
      identity.emoji = value;
    }
    if (label === "creature") {
      identity.creature = value;
    }
    if (label === "vibe") {
      identity.vibe = value;
    }
    if (label === "theme") {
      identity.theme = value;
    }
    if (label === "avatar") {
      identity.avatar = value;
    }
  }
  return identity;
}

export function identityHasValues(identity: AgentIdentityFile): boolean {
  return Boolean(
    identity.name ||
    identity.emoji ||
    identity.theme ||
    identity.creature ||
    identity.vibe ||
    identity.avatar,
  );
}

export function loadIdentityFromFile(identityPath: string): AgentIdentityFile | null {
  try {
    const content = fs.readFileSync(identityPath, "utf-8");
    const parsed = parseIdentityMarkdown(content);
    if (!identityHasValues(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadAgentIdentityFromWorkspace(workspace: string): AgentIdentityFile | null {
  const identityPath = path.join(workspace, DEFAULT_IDENTITY_FILENAME);
  return loadIdentityFromFile(identityPath);
}

// --- Business profile types and parsing ---

export type BusinessProfileFile = {
  name?: string;
  type?: string;
  location?: string;
  hours?: string;
  website?: string;
};

export type OwnerProfileFile = {
  name?: string;
  phone?: string;
  language?: string;
  timezone?: string;
};

const BUSINESS_PLACEHOLDER_VALUES = new Set([
  "e.g. electronics shop, tiffin service, clothing store, general store",
  "city, area, or address",
  "e.g. 10am-8pm, mon-sat",
]);

export function isBusinessPlaceholder(value: string): boolean {
  const normalized = normalizeIdentityValue(value);
  return BUSINESS_PLACEHOLDER_VALUES.has(normalized);
}

function parseKeyValueMarkdown<T extends Record<string, string | undefined>>(
  content: string,
  fieldMap: Record<string, keyof T>,
  placeholderCheck: (value: string) => boolean,
): T {
  const result = {} as T;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = line.trim().replace(/^\s*-\s*/, "");
    const colonIndex = cleaned.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const label = cleaned.slice(0, colonIndex).replace(/[*_]/g, "").trim().toLowerCase();
    const value = cleaned
      .slice(colonIndex + 1)
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    if (!value) {
      continue;
    }
    if (placeholderCheck(value)) {
      continue;
    }
    const field = fieldMap[label];
    if (field) {
      (result as Record<string, string>)[field as string] = value;
    }
  }
  return result;
}

export function parseBusinessMarkdown(content: string): BusinessProfileFile {
  return parseKeyValueMarkdown<BusinessProfileFile>(
    content,
    {
      name: "name",
      type: "type",
      location: "location",
      hours: "hours",
      website: "website",
    },
    isBusinessPlaceholder,
  );
}

export function parseOwnerMarkdown(content: string): OwnerProfileFile {
  return parseKeyValueMarkdown<OwnerProfileFile>(
    content,
    {
      name: "name",
      phone: "phone",
      language: "language",
      timezone: "timezone",
    },
    isBusinessPlaceholder,
  );
}

export function businessProfileHasValues(profile: BusinessProfileFile): boolean {
  return Boolean(
    profile.name || profile.type || profile.location || profile.hours || profile.website,
  );
}

export function loadBusinessProfileFromWorkspace(workspace: string): BusinessProfileFile | null {
  const businessPath = path.join(workspace, DEFAULT_BUSINESS_FILENAME);
  try {
    const content = fs.readFileSync(businessPath, "utf-8");
    const parsed = parseBusinessMarkdown(content);
    if (!businessProfileHasValues(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
