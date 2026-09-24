# TASK-005 — Evoluir as exportações PDF e Excel

## Objetivo

Incorporar a foto histórica do kit nas exportações e substituir o arquivo HTML com extensão `.xls`
por um workbook `.xlsx` real, preservando paginação, dados tipados e permissões.

## Dependências

- `TASK-003`;
- `TASK-004`.

## Requisitos atendidos

- `RF-PDF-001` a `RF-PDF-006`;
- `RF-XLS-001` a `RF-XLS-006`;
- critérios de aceite 14 e 15.

## Escopo de implementação

### PDF

- carregar de forma autenticada a imagem `display` da `CalculationVersion`;
- tornar a exportação assíncrona e tratar falha de imagem sem perder o documento;
- incorporar a foto com proporção preservada no cabeçalho;
- reorganizar código, descrição, lista, versão, data, responsável e totais;
- recalcular início e largura da tabela;
- repetir cabeçalhos em páginas adicionais e preservar rodapé/número de página;
- usar a imagem correta ao exportar pelo histórico;
- continuar exportando cálculos sem foto.

### Excel

- escolher e registrar a biblioteca final, com preferência inicial por `exceljs`;
- substituir os dois geradores HTML atuais por `.xlsx` real;
- incorporar a foto no cabeçalho do workbook;
- criar células numéricas para preços, totais e quantidades;
- aplicar formatos de moeda, número e data;
- configurar larguras, alturas, cabeçalho, congelamento e área de impressão;
- usar a imagem de `CalculationVersion` em Detalhes/histórico;
- usar a imagem local selecionada ao exportar uma prévia não salva;
- atualizar nome/extensão e contratos de download esperados.

### Experiência e segurança

- desabilitar o botão durante a geração;
- mostrar erro recuperável sem sair da tela;
- manter `calculation.export` como requisito;
- não expor URL temporária ou conteúdo binário em logs;
- liberar recursos temporários do navegador depois do download.

## Arquivos e módulos prováveis

- `src/web/detail-page.ts`;
- `src/web/calculations-page.ts`;
- utilitários compartilhados de exportação;
- `package.json` e lockfile;
- testes E2E de Detalhes e Calcular;
- possíveis testes auxiliares para abrir PDF e `.xlsx`.

## Testes obrigatórios

- PDF com foto, sem foto e com falha simulada de carregamento;
- PDF de múltiplas páginas sem sobreposição;
- PDF de versão histórica usando o ativo antigo;
- `.xlsx` abre como workbook válido;
- `.xlsx` contém relacionamento de imagem incorporada;
- valores e quantidades permanecem numéricos;
- prévia não salva exporta a imagem local;
- histórico exporta sua própria imagem;
- usuário sem permissão não vê/usa as ações;
- nomes dos arquivos usam `.xlsx` e testes não esperam mais `.xls`.

## Evidências de conclusão

- PDF renderizado para inspeção visual;
- workbook inspecionado estruturalmente e aberto por biblioteca de leitura;
- evidência de imagem incorporada, sem dependência de URL externa;
- testes de versão histórica e ausência de foto aprovados.

## Concluída quando

PDF e Excel representam fielmente a versão do cálculo, contêm a foto correta quando disponível e
continuam válidos e legíveis quando não houver imagem.

## Resultado da execução

- `exceljs` 4.4 foi adotado para os workbooks `.xlsx`; os dois geradores HTML/`.xls` foram
  substituídos por uma implementação compartilhada com imagem incorporada, células numéricas,
  data tipada, formatos, dimensões, congelamento e configuração de impressão.
- PDF e Excel carregam a variante `display` com a sessão do navegador, usam o ativo da versão
  consultada e seguem gerando o documento quando a imagem falha ou não existe.
- A prévia não salva prioriza o arquivo de foto local e as ações continuam condicionadas a
  `calculation.export`, com botão desabilitado durante a geração e liberação das URLs temporárias.
- Foram adicionadas verificações estruturais do workbook, relacionamento de imagem, tipos
  numéricos, PDF multipágina, ausência/falha de foto, imagem local, versão histórica e permissão.
