-- Migration to add topic and post_type columns to posts table
-- This fixes the 502 error on api/ai/batch-text-posts endpoint

-- Add topic column to posts table (safe for MySQL 5.7+)
-- If columns already exist, this will fail silently - that's OK
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_name = 'posts' AND column_name = 'topic' AND table_schema = DATABASE()) > 0,
    'SELECT 1',
    'ALTER TABLE posts ADD COLUMN topic VARCHAR(255) DEFAULT NULL AFTER campaign'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add post_type column to posts table
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_name = 'posts' AND column_name = 'post_type' AND table_schema = DATABASE()) > 0,
    'SELECT 1',
    'ALTER TABLE posts ADD COLUMN post_type ENUM(''text_only'', ''image'', ''carousel'') DEFAULT NULL AFTER topic'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill topic from visual_cards if needed
UPDATE posts p
INNER JOIN visual_cards vc ON vc.id = p.visual_card_id
SET p.topic = vc.topic
WHERE p.topic IS NULL AND vc.topic IS NOT NULL;

-- Set post_type based on media_type or storage_path
UPDATE posts p
LEFT JOIN visual_cards vc ON vc.id = p.visual_card_id
SET p.post_type = CASE
    WHEN vc.storage_path = '_text_' THEN 'text_only'
    WHEN p.media_type = 'carousel' THEN 'carousel'
    ELSE 'image'
END
WHERE p.post_type IS NULL;

-- Optionally, backfill topic from visual_cards if needed
UPDATE posts p
INNER JOIN visual_cards vc ON vc.id = p.visual_card_id
SET p.topic = vc.topic
WHERE p.topic IS NULL AND vc.topic IS NOT NULL;

-- Set post_type based on media_type or storage_path
UPDATE posts p
INNER JOIN visual_cards vc ON vc.id = p.visual_card_id
SET p.post_type = CASE
    WHEN vc.storage_path = '_text_' THEN 'text_only'
    ELSE COALESCE(p.media_type, 'image')
END
WHERE p.post_type IS NULL;
