CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  negative_prompt TEXT,
  category TEXT,
  style TEXT,
  original_style TEXT,
  scene TEXT,
  image_type TEXT,
  product_category TEXT,
  platform_source TEXT,
  source_url TEXT,
  remark TEXT,
  tags TEXT,
  example_image_path TEXT,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  usage_count INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_file, source_id)
);

CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_style ON prompts(style);
CREATE INDEX IF NOT EXISTS idx_prompts_scene ON prompts(scene);
CREATE INDEX IF NOT EXISTS idx_prompts_image_type ON prompts(image_type);
CREATE INDEX IF NOT EXISTS idx_prompts_product_category ON prompts(product_category);
CREATE INDEX IF NOT EXISTS idx_prompts_platform_source ON prompts(platform_source);
CREATE INDEX IF NOT EXISTS idx_prompts_is_enabled ON prompts(is_enabled);
CREATE INDEX IF NOT EXISTS idx_prompts_generation_status ON prompts(generation_status);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider_config TEXT NOT NULL,
  placeholder_value TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'partially_failed', 'cancelled')),
  total_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  concurrency INTEGER DEFAULT 2,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  finished_at DATETIME
);

CREATE TABLE IF NOT EXISTS job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  prompt_id INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  image_path TEXT,
  attempt_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_items_prompt_id ON job_items(prompt_id);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
