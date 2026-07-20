export const SCHEMA_DDL = `
CREATE SEQUENCE IF NOT EXISTS seq_file_id START 1;
CREATE SEQUENCE IF NOT EXISTS seq_symbol_id START 1;
CREATE SEQUENCE IF NOT EXISTS seq_edge_id START 1;

CREATE TABLE IF NOT EXISTS file (
    id BIGINT PRIMARY KEY DEFAULT nextval('seq_file_id'),
    path TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    hash TEXT NOT NULL,
    language TEXT,
    layer TEXT,
    last_modified INTEGER,
    is_test BOOLEAN DEFAULT FALSE,
    is_parseable BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_file_path ON file(path);
CREATE INDEX IF NOT EXISTS idx_file_hash ON file(hash);

CREATE TABLE IF NOT EXISTS symbol (
    id BIGINT PRIMARY KEY DEFAULT nextval('seq_symbol_id'),
    file_id BIGINT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT,
    line_start INTEGER,
    line_end INTEGER,
    scope TEXT,
    docstring TEXT,
    snippet TEXT,
    complexity INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_symbol_name ON symbol(name);
CREATE INDEX IF NOT EXISTS idx_symbol_file_id ON symbol(file_id);

CREATE TABLE IF NOT EXISTS edge (
    id BIGINT PRIMARY KEY DEFAULT nextval('seq_edge_id'),
    from_symbol_id BIGINT NOT NULL REFERENCES symbol(id) ON DELETE CASCADE,
    to_symbol_id BIGINT NOT NULL REFERENCES symbol(id) ON DELETE CASCADE,
    kind TEXT,
    is_precise BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_edge_from ON edge(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_edge_to ON edge(to_symbol_id);

CREATE TABLE IF NOT EXISTS workspace_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;
