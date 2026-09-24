# TASK-001 — Construir a fundação segura de mídia

## Objetivo

Criar a base persistente, segura e reutilizável para fotos de produtos e kits, sem ainda redesenhar
as telas de negócio. Ao final, o sistema deve conseguir validar, processar, armazenar, relacionar,
servir e auditar imagens.

## Dependências

Nenhuma.

## Requisitos atendidos

- `RF-MID-001` a `RF-MID-009`;
- `RF-CAT-001` e `RF-CAT-002`;
- seções 16, 17, 20 e 21 do `spec.md`;
- `RNF-002`, `RNF-003`, `RNF-006` e `RNF-007`.

## Escopo de implementação

### Modelo e migration

- criar o modelo persistente de ativo de mídia com metadados, variante de exibição e miniatura;
- adicionar vínculos opcionais de imagem atual em `Product` e `Kit`;
- adicionar vínculo opcional de imagem histórica em `CalculationVersion`;
- definir relações Prisma sem cascata destrutiva de ativos ainda referenciados;
- criar migration aditiva, sem backfill inventado e sem alterar cálculos existentes;
- garantir que consultas comuns não selecionem blobs implicitamente.

### Processamento e armazenamento

- introduzir uma abstração de armazenamento com implementação inicial em MySQL;
- adicionar a biblioteca de processamento escolhida, com preferência por `sharp`;
- validar assinatura, tipo, bytes, pixels e decodificação;
- aceitar JPEG, PNG e WebP e recusar SVG;
- corrigir orientação, remover metadados, limitar dimensões e comprimir;
- gerar as variantes `thumb` e `display`;
- calcular SHA-256 e registrar dimensões/tamanhos processados;
- garantir que conteúdo binário não apareça em logs ou auditoria.

### Serviço e API de mídia

- criar serviço responsável por upload, leitura por variante e remoção segura de vínculos;
- servir imagens por endpoint autenticado com `Content-Type`, `ETag`, cache privado e tratamento de
  `If-None-Match`;
- impedir acesso indevido por manipulação de identificador;
- definir o contrato compartilhado `ImageReference | null`;
- centralizar a conversão de ativo em URLs seguras, sem expor caminho ou chave de armazenamento.

### Permissão e auditoria

- adicionar a permissão final equivalente a `catalog.manage` nos contratos e seed;
- manter visualização coerente com as permissões das telas consumidoras;
- criar ações de auditoria para adicionar, substituir e remover foto;
- registrar ator, entidade, ativo anterior, ativo novo, origem e `requestId`.

### Compatibilidade frontend

- ajustar a CSP para permitir `blob:` somente no contexto necessário à prévia local;
- criar utilitário ou componente básico de imagem com placeholder, erro e texto alternativo, pronto
  para ser usado nas tarefas seguintes;
- não alterar ainda o layout completo das telas Produtos, Pedidos ou cálculos.

## Arquivos e módulos prováveis

- `prisma/schema.prisma` e nova migration;
- `src/shared/auth.ts` e novo contrato compartilhado de mídia;
- `prisma/seed.ts`;
- novo módulo em `src/server/modules/media/`;
- `src/server/app.ts` e `src/server/server.ts`;
- configuração de ambiente apenas se a abstração exigir;
- componente/utilitário em `src/web/`;
- `package.json` e lockfile.

## Testes obrigatórios

- unitários de assinatura, tamanho, dimensão, normalização, hash e variantes;
- teste de migration aditiva e relações opcionais;
- integração de upload válido e rejeição de SVG, arquivo falso, corrompido e excessivo;
- integração de autenticação, autorização, `ETag`, `304` e cache;
- auditoria sem conteúdo binário;
- confirmação de que listagens Prisma não carregam blobs;
- typecheck dos contratos compartilhados.

## Evidências de conclusão

- migration aplicável sobre banco existente;
- endpoints de mídia demonstrados com imagem real e resposta `304`;
- contratos retornando `ImageReference | null`;
- testes aprovados e limites documentados;
- decisão final sobre formatos processados e biblioteca registrada neste arquivo.

## Concluída quando

O sistema consegue armazenar e servir com segurança uma foto de produto ou kit, preserva referências
históricas e continua lendo todos os registros existentes com imagem nula.

## Resultado da execução

Implementada em 2026-09-23.

### Decisões técnicas

- processamento com `sharp`;
- entrada aceita: JPEG, PNG e WebP, validada por assinatura, extensão, MIME, decodificação, bytes e
  pixels; SVG é recusado;
- limite de entrada: 5 MB e 12 megapixels;
- saída normalizada: WebP sem metadados, orientação corrigida, `display` de até 1600 x 1600 com
  qualidade 82 e `thumb` de até 320 x 320 com qualidade 76, sempre preservando proporção e sem
  ampliar a origem;
- armazenamento inicial: blobs imutáveis no MySQL por meio da abstração `MediaStore`, com
  implementação `PrismaMediaStore`;
- SHA-256 registrado para origem e para cada variante; cada variante também registra dimensões e
  tamanho processado;
- leitura permitida somente para ativos ainda referenciados por produto, kit ou versão de cálculo;
  URLs públicas internas não expõem chave ou caminho de armazenamento.

### Entrega

- migration aditiva `20260923120000_media_foundation`, sem backfill, com `MediaAsset` e vínculos
  opcionais em `Product`, `Kit` e `CalculationVersion`, todos sem cascata destrutiva;
- contrato compartilhado `ImageReference | null` e conversão centralizada para URLs autenticadas;
- `PUT` e `DELETE` em `/api/v1/media/products/:id` e `/api/v1/media/kits/:id`, protegidos por
  `catalog.manage`;
- `GET /api/v1/media/:id/:variant`, protegido por sessão e capacidade consumidora, com
  `Content-Type`, `ETag`, `Cache-Control: private, max-age=31536000, immutable` e resposta `304`;
- auditoria `MEDIA_ADDED`, `MEDIA_REPLACED` e `MEDIA_REMOVED` contendo somente IDs, ator, entidade,
  origem e `requestId`, sem conteúdo binário;
- componente base `createMediaImage` com dimensões estáveis, texto alternativo, carregamento tardio
  e placeholder para ausência ou erro;
- CSP permite `blob:` somente em `img-src`, para a futura prévia local da tela Calcular;
- seed e contratos incluem `catalog.manage`, concedida ao modelo Administrador.

### Verificação

- 39 arquivos de teste e 179 testes aprovados, incluindo 20 testes novos da fundação de mídia;
- lint e typecheck aprovados;
- bundle Vite e compilação TypeScript do servidor aprovados;
- o script agregado `npm run build` chegou à geração Prisma, mas o Windows não permitiu substituir a
  DLL do query engine porque o servidor de desenvolvimento já estava ativo. O cliente e seus tipos
  foram regenerados com `prisma generate --no-engine`, e todas as etapas restantes do build foram
  executadas separadamente com sucesso. Com o servidor parado, `npm run build` executa o fluxo
  agregado normalmente.
