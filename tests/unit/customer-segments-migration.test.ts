import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const customersMigrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260802183000_customers/migration.sql',
);
const segmentsMigrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260912190000_customer_segment_backfill/migration.sql',
);
const divergencesPath = resolve(process.cwd(), 'scripts/customer-segment-divergences.sql');

const segmentMapping = new Map<string, string>([
  ['AUTO-PECAS', 'AUTO_PARTS'],
  ['AUTORIZADA', 'AUTHORIZED'],
  ['CONSUMIDOR FINAL', 'END_CONSUMER'],
  ['DISTRIBUIDOR', 'DISTRIBUTOR'],
  ['FROTISTA', 'FLEET_OWNER'],
  ['IMPLEMENTADOR', 'IMPLEMENTER'],
  ['POSTO DE SERVICO', 'SERVICE_STATION'],
]);

function readLegacySegments(sql: string): Array<string | null> {
  const rows = [
    ...sql.matchAll(/^\(UUID\(\), '(?:''|[^'])*', '(?:''|[^'])*', (NULL|'(?:''|[^'])*')/gm),
  ];

  return rows.map((row) => {
    const value = row[1];
    if (!value) throw new Error('Linha de cliente sem valor de segmento reconhecível.');
    return value === 'NULL' ? null : value.slice(1, -1).replaceAll("''", "'");
  });
}

describe('migração dos segmentos de clientes', () => {
  it('mapeia inequivocamente os sete valores legados e mantém nulos não classificados', async () => {
    const customersMigration = await readFile(customersMigrationPath, 'utf8');
    const legacySegments = readLegacySegments(customersMigration);
    const mappedSegments = legacySegments.filter(
      (segment): segment is string => segment !== null && segmentMapping.has(segment),
    );
    const unmappedSegments = legacySegments.filter(
      (segment): segment is string => segment !== null && !segmentMapping.has(segment),
    );

    expect(legacySegments).toHaveLength(1507);
    expect(mappedSegments).toHaveLength(1505);
    expect(legacySegments.filter((segment) => segment === null)).toHaveLength(2);
    expect(unmappedSegments).toEqual([]);
  });

  it('cria os segmentos por código e preenche somente FKs ainda nulas', async () => {
    const migration = await readFile(segmentsMigrationPath, 'utf8');

    for (const [legacyValue, normalizedCode] of segmentMapping) {
      expect(migration).toContain(`'${normalizedCode}'`);
      expect(migration).toContain(`WHEN '${legacyValue}' THEN '${normalizedCode}'`);
    }

    expect(migration).toContain('ON DUPLICATE KEY UPDATE');
    expect(migration).toContain('WHERE `customer`.`customer_segment_id` IS NULL');
    expect(migration).toContain('AND `customer`.`segment` IS NOT NULL');
    expect(migration).not.toMatch(/\b(?:DELETE|DROP|TRUNCATE)\b/i);
    expect(migration).not.toContain('customer_class_id');
  });

  it('fornece uma consulta de divergências sem reparo automático', async () => {
    const report = await readFile(divergencesPath, 'utf8');

    expect(report).toContain('total_customers');
    expect(report).toContain('UNMAPPED_LEGACY_SEGMENT');
    expect(report).toContain('NORMALIZED_SEGMENT_MISSING');
    expect(report).toContain('NORMALIZED_SEGMENT_MISMATCH');
    expect(report).toContain('UNEXPECTED_CLASSIFICATION_WITHOUT_LEGACY_SEGMENT');
    expect(report).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b/i);
  });
});
