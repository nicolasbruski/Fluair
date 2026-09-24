import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260912180000_customer_classifications/migration.sql',
);

describe('migração das classificações de clientes', () => {
  it('é aditiva e mantém o segmento textual legado', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE `customer_classes`');
    expect(migration).toContain('CREATE TABLE `customer_segments`');
    expect(migration).toContain('ADD COLUMN `customer_class_id` CHAR(36) NULL');
    expect(migration).toContain('ADD COLUMN `customer_segment_id` CHAR(36) NULL');
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/\b(?:DELETE|UPDATE)\s+`?customers`?\b/i);
    expect(migration).not.toMatch(/(?:DROP|CHANGE|RENAME)\s+(?:COLUMN\s+)?`?segment`?/i);
  });

  it('define códigos estáveis únicos e situação para as duas classificações', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('UNIQUE INDEX `customer_classes_code_key` (`code`)');
    expect(migration).toContain('UNIQUE INDEX `customer_segments_code_key` (`code`)');
    expect(migration.match(/`active` BOOLEAN NOT NULL DEFAULT true/g)).toHaveLength(2);
  });
});
