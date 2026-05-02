-- Blog Management System Database Schema
-- For Neon PostgreSQL Database

-- Create blogs table
CREATE TABLE IF NOT EXISTS blogs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_url VARCHAR(500),
    author VARCHAR(100) DEFAULT 'Stephen Mulingwa',
    category VARCHAR(100),
    tags TEXT[], -- Array of tags
    published BOOLEAN DEFAULT true,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    views INTEGER DEFAULT 0,
    meta_description VARCHAR(500),
    meta_keywords VARCHAR(500)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON blogs(category);
CREATE INDEX IF NOT EXISTS idx_blogs_created_at ON blogs(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_blogs_updated_at ON blogs;
CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON blogs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create admin_users table for authentication
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Portfolio projects (managed from admin)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    summary TEXT,
    description TEXT,
    category VARCHAR(100),
    features TEXT[],
    image_url VARCHAR(500),
    project_url VARCHAR(500),
    secondary_url VARCHAR(500),
    featured BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(published);
CREATE INDEX IF NOT EXISTS idx_projects_sort ON projects(sort_order);

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Extended project storytelling (case-study layout)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS problem_statement TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outcome_text TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name VARCHAR(200);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(120);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_label VARCHAR(120);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tech_tags TEXT[];
