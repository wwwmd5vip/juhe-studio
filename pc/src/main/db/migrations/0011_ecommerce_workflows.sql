CREATE TABLE ecommerce_workflows (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tv',
  context TEXT NOT NULL,
  steps TEXT NOT NULL,
  modules TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ecommerce_workflows_template_idx ON ecommerce_workflows(template_id);
CREATE INDEX ecommerce_workflows_status_idx ON ecommerce_workflows(status);
CREATE INDEX ecommerce_workflows_updated_at_idx ON ecommerce_workflows(updated_at);
CREATE INDEX ecommerce_workflows_category_idx ON ecommerce_workflows(category);
