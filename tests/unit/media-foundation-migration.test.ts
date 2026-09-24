import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../prisma/migrations/20260923120000_media_foundation/migration.sql',
  import.meta.url,
);

describe('migration da fundação de mídia', () => {
  it('é aditiva, mantém vínculos opcionais e não usa cascata destrutiva', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE `media_assets`');
    expect(sql).toContain('`current_image_id` CHAR(36) NULL');
    expect(sql).toContain('`kit_image_id` CHAR(36) NULL');
    expect(sql.match(/ON DELETE RESTRICT/g)?.length).toBe(4);
    expect(sql).not.toMatch(/UPDATE\s+`?(products|kits|calculation_versions)`?/i);
    expect(sql).not.toContain('ON DELETE CASCADE');
  });

  it('separa metadados e variantes dos vínculos das entidades', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('`display_data` LONGBLOB NOT NULL');
    expect(sql).toContain('`thumbnail_data` LONGBLOB NOT NULL');
    expect(sql).toContain('`display_sha256` CHAR(64) NOT NULL');
    expect(sql).toContain('`thumbnail_sha256` CHAR(64) NOT NULL');
  });
});
