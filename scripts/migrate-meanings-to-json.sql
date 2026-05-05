-- 安全迁移：将 Word.meanings 从 String[] 转换为 Json[]
-- 执行前会自动备份数据

BEGIN;

-- 1. 创建备份表
CREATE TABLE IF NOT EXISTS "Word_meanings_backup_20260505" AS
SELECT id, text, meanings AS meanings_old
FROM "Word";

-- 2. 添加临时列存储 JSON 格式的 meanings
ALTER TABLE "Word" ADD COLUMN "meanings_new" JSONB[];

-- 3. 迁移数据：将 string[] 转换为 Meaning[] 格式
UPDATE "Word"
SET "meanings_new" = (
  SELECT ARRAY_AGG(
    jsonb_build_object(
      'type', '',
      'content', meaning_text,
      'sentence', ''
    )
  )
  FROM unnest(meanings::text[]) AS meaning_text
);

-- 4. 删除旧列
ALTER TABLE "Word" DROP COLUMN "meanings";

-- 5. 重命名新列
ALTER TABLE "Word" RENAME COLUMN "meanings_new" TO "meanings";

-- 6. 记录迁移日志
CREATE TABLE IF NOT EXISTS "_migration_log" (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  backup_table TEXT,
  status TEXT DEFAULT 'completed'
);

INSERT INTO "_migration_log" (migration_name, backup_table, status)
VALUES ('change_meanings_to_json', 'Word_meanings_backup_20260505', 'completed');

COMMIT;

-- 成功提示
DO $$
BEGIN
  RAISE NOTICE '迁移成功完成！备份表: Word_meanings_backup_20260505';
  RAISE NOTICE '如需回滚，请运行: SELECT rollback_meanings_migration();';
END $$;
