-- Synthetic schema for Source Profiler tests. No real data.

CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  owner_id INTEGER
);

CREATE TABLE deals (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2),
  stage VARCHAR(64),
  company_id INTEGER REFERENCES companies(id),
  owner_id INTEGER,
  due_date TIMESTAMP
);
