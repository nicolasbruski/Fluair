import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const commissionsPage = resolve(process.cwd(), 'Comissoes/sistema_comissao_v3.html');

describe('compatibilidade da tela de comissões com clientes normalizados', () => {
  it('prioriza o rótulo legado e aceita o segmento normalizado como fallback', async () => {
    const source = await readFile(commissionsPage, 'utf8');

    expect(source).toContain("segmento:customer.segment||customer.customerSegment?.name||''");
    expect(source).toContain("vendedor:customer.seller||''");
    expect(source).toContain("representante:customer.representative||''");
  });

  it('mantém busca e filtros locais por segmento, vendedor e representante', async () => {
    const source = await readFile(commissionsPage, 'utf8');

    expect(source).toContain('id="cliSeg"');
    expect(source).toContain("const seg=document.getElementById('cliSeg')?.value||'';");
    expect(source).toContain('if(seg&&c.segmento!==seg)return false;');
    expect(source).toContain('if(vend&&c.vendedor!==vend)return false;');
    expect(source).toContain("if(rep==='__direto__'&&c.representante)return false;");
  });
});
