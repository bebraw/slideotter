CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presentations (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  latest_version INTEGER NOT NULL,
  r2_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS slides (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  presentation_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL,
  spec_object_key TEXT NOT NULL,
  PRIMARY KEY (workspace_id, presentation_id, id),
  FOREIGN KEY (workspace_id, presentation_id) REFERENCES presentations(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  presentation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  provider_snapshot_json TEXT,
  base_version INTEGER,
  grounding_summary_json TEXT,
  diagnostics_json TEXT,
  result_object_key TEXT,
  failure_detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, presentation_id, id),
  FOREIGN KEY (workspace_id, presentation_id) REFERENCES presentations(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS provider_configs (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  credential_ref TEXT,
  allowed_data_classes_json TEXT NOT NULL,
  enabled_workflows_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  presentation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  object_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, presentation_id, id),
  FOREIGN KEY (workspace_id, presentation_id) REFERENCES presentations(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  presentation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, presentation_id, id),
  FOREIGN KEY (workspace_id, presentation_id) REFERENCES presentations(workspace_id, id)
);

CREATE INDEX IF NOT EXISTS idx_presentations_workspace_updated
  ON presentations (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_slides_presentation_order
  ON slides (workspace_id, presentation_id, order_index);

CREATE INDEX IF NOT EXISTS idx_jobs_presentation_created
  ON jobs (workspace_id, presentation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_configs_updated
  ON provider_configs (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_presentation_updated
  ON sources (workspace_id, presentation_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_materials_presentation_updated
  ON materials (workspace_id, presentation_id, updated_at DESC);
