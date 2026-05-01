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
