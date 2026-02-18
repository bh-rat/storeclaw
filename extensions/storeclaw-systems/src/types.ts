export type SystemManifest = {
  name: string;
  description: string;
  model?: {
    state_files?: string[];
  };
  controller?: {
    schemas?: string[];
    workflows?: string[];
    scripts?: string[];
  };
  views?: string[];
  schedule?: Array<{
    name: string;
    cron: string;
    task: string;
  }>;
};

export type SystemEntry = {
  name: string;
  dir: string;
  manifest: SystemManifest;
  systemMdPath: string;
  capabilities: string[];
};

export type SystemsConfig = {
  enabled: boolean;
  maxSystems: number;
};
