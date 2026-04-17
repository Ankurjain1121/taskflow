-- Add proper ON DELETE actions to foreign keys that currently default to NO ACTION.
-- tasks.created_by_id -> ON DELETE SET NULL (must also make column nullable)
-- comments.author_id  -> ON DELETE SET NULL (must also make column nullable)
-- comments.parent_id  -> ON DELETE CASCADE

-- 1. tasks.created_by_id: allow NULL, re-add FK with ON DELETE SET NULL
ALTER TABLE tasks ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_id_fkey;
ALTER TABLE tasks
    ADD CONSTRAINT tasks_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2. comments.author_id: allow NULL, re-add FK with ON DELETE SET NULL
ALTER TABLE comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE comments
    ADD CONSTRAINT comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. comments.parent_id: re-add FK with ON DELETE CASCADE
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;
ALTER TABLE comments
    ADD CONSTRAINT comments_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
