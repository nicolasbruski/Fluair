# Tasks — Fotos de kits e produtos

## 1. Objetivo

Implementar a especificação de `spec-fotos-catalogo/spec.md` em seis entregas verticais, coesas e
verificáveis. O planejamento evita uma tarefa por arquivo, endpoint ou teste; cada tarefa deve
entregar uma capacidade completa que possa ser revisada e validada.

## 2. Convenções

- `[ ]`: não iniciada;
- `[~]`: em andamento;
- `[x]`: concluída e verificada;
- requisitos `RF-*` e `RNF-*` referenciam o `spec.md` desta pasta;
- cada tarefa possui um arquivo próprio com o detalhamento necessário;
- descobertas técnicas devem ser incorporadas à tarefa responsável, sem criar microtarefas;
- uma nova tarefa só deve ser criada quando existir uma entrega realmente independente;
- o total não deve ultrapassar oito tarefas sem justificativa registrada neste arquivo.

## 3. Definição global de pronto

Uma tarefa só pode ser marcada como concluída quando:

1. seu comportamento estiver implementado de ponta a ponta;
2. validação, autorização, segurança e estados de erro aplicáveis estiverem cobertos;
3. dados e cálculos históricos existentes permanecerem íntegros;
4. os testes previstos estiverem criados ou atualizados e aprovados;
5. formatação, lint e typecheck dos arquivos afetados estiverem aprovados;
6. documentação afetada não contradisser o comportamento entregue;
7. o resultado e eventuais decisões técnicas estiverem registrados no arquivo da tarefa.

## 4. Ordem de execução

### [x] TASK-001 — Construir a fundação segura de mídia

- Arquivo: `task-001-fundacao-midia.md`
- Dependências: nenhuma.
- Entrega: schema, migration, armazenamento, processamento, leitura autenticada, contrato comum,
  permissão e auditoria.
- Requisitos principais: `RF-MID-*`, `RF-CAT-001`, `RF-CAT-002`, seção 16, seção 17, seção 20 e
  seção 21.

### [x] TASK-002 — Transformar Produtos em catálogo com gestão de fotos

- Arquivo: `task-002-catalogo-produtos.md`
- Dependências: `TASK-001`.
- Entrega: catálogo unificado de kits e produtos avulsos, filtros e gestão completa da foto atual.
- Requisitos principais: `RF-PRO-*`, `RF-CAT-006`, `RNF-001` a `RNF-005`.

### [x] TASK-003 — Integrar foto ao cálculo e ao versionamento histórico

- Arquivo: `task-003-calculo-versionamento.md`
- Dependências: `TASK-001`.
- Entrega: seleção opcional no começo de Calcular, salvamento multipart e snapshot imutável por
  `CalculationVersion`.
- Requisitos principais: `RF-CAL-*`, `RF-CAT-003` a `RF-CAT-005`.

### [x] TASK-004 — Propagar as imagens para consulta e Pedidos

- Arquivo: `task-004-consulta-pedidos.md`
- Dependências: `TASK-002`, `TASK-003`.
- Entrega: contratos e apresentação em Buscar, Detalhes, histórico, drawer e carrinho de Pedidos.
- Requisitos principais: `RF-BUS-*`, `RF-DET-*`, `RF-PED-*` e seção 19.

### [x] TASK-005 — Evoluir as exportações PDF e Excel

- Arquivo: `task-005-exportacoes.md`
- Dependências: `TASK-003`, `TASK-004`.
- Entrega: PDF com foto histórica e substituição do `.xls` HTML por workbook `.xlsx` real com
  imagem incorporada.
- Requisitos principais: `RF-PDF-*`, `RF-XLS-*`.

### [x] TASK-006 — Validar migração, qualidade e entrega completa

- Arquivo: `task-006-qualidade-entrega.md`
- Dependências: `TASK-001` a `TASK-005`.
- Entrega: suíte completa, verificação visual e de artefatos, documentação, ensaio de migration,
  desempenho e quality gate.
- Requisitos principais: seções 22 a 26 do `spec.md`.

## 5. Fluxo resumido

```text
TASK-001 Fundação de mídia
├── TASK-002 Catálogo Produtos
└── TASK-003 Calcular e versionamento
    └── TASK-004 Buscar, Detalhes e Pedidos
        └── TASK-005 PDF e Excel
            └── TASK-006 Qualidade e entrega
```

`TASK-002` e `TASK-003` podem ser executadas em paralelo depois da fundação, desde que alterações em
contratos e schema sejam coordenadas. As demais devem respeitar as dependências indicadas.

## 6. Controle de escopo

Não criar tarefas separadas para:

- instalar uma dependência;
- adicionar um campo ou DTO;
- criar um endpoint isolado;
- ajustar uma única tela;
- escrever uma categoria de teste;
- atualizar um documento;
- corrigir um problema encontrado dentro do escopo de uma tarefa ainda aberta.

Esses trabalhos pertencem à entrega vertical correspondente. Se uma descoberta exigir uma sétima
ou oitava tarefa, registrar aqui a razão, dependências e impacto antes de iniciá-la.
