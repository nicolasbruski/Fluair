# TASK-024 — Ensaio de migração e quality gate final

Data do ensaio: 14 de setembro de 2026.

## Escopo e ambiente

O ensaio foi executado em uma instância MySQL 8.4 descartável e isolada da base de desenvolvimento.
A origem foi copiada por `mysqldump --single-transaction --no-tablespaces`, sem alterar os dados de
origem. Este relatório registra somente contagens e identificadores sintéticos; não contém nomes,
documentos, credenciais ou outros dados de clientes.

A cópia de origem continha 19 tabelas, 1.507 clientes, três perfis legados e cinco migrations. Como
ela não continha versões de matriz nem cálculos históricos reais, foi acrescentado na cópia um
conjunto mínimo sanitizado: uma versão, um item, uma série de kit, um cálculo, um item de cálculo e
um vínculo com cliente. Os UUIDs sintéticos permitem verificar preservação de identidade sem
versionar dados comerciais.

## Aplicação e repetibilidade

- Sete migrations pendentes foram aplicadas, totalizando 12 migrations, em **13,01 segundos**.
- O seed foi executado duas vezes sobre a base migrada, sem duplicação ou falha.
- Uma segunda execução de `prisma migrate deploy` encontrou as 12 migrations e informou que não
  havia migration pendente.
- O script de divergências de histórico de listas não retornou linhas.
- O script de segmentos contabilizou 1.507 clientes: 1.505 classificados e dois sem segmento legado
  e sem classificação. Esses dois registros não são divergências nem receberam classificação
  inventada; permanecem para tratamento manual conforme a regra de migração.

Correções feitas durante a preparação do ensaio:

1. o dump inicial solicitava o privilégio `PROCESS`; a cópia foi repetida com `--no-tablespaces`,
   opção compatível com o usuário limitado;
2. a primeira inserção da massa sintética falhou por escape do nome de uma coluna no shell; a
   transação foi revertida integralmente, a contagem zero foi conferida e o comando foi corrigido;
3. uma tentativa de repetir o deploy dentro do sandbox não conseguiu validar o binário do Prisma;
   a mesma execução foi repetida no ambiente autorizado e concluiu sem migrations pendentes.

Nenhuma dessas correções alterou a base de origem ou deixou escrita parcial.

## Reconciliação e rollback

| Controle                                               |                 Antes |                Depois | Resultado                                 |
| ------------------------------------------------------ | --------------------: | --------------------: | ----------------------------------------- |
| Clientes                                               |                 1.507 |                 1.507 | preservados                               |
| Perfis legados / listas de componentes correspondentes |                     3 |                     3 | correspondência integral                  |
| Classes / segmentos estruturais                        |                     — |                 4 / 9 | seed idempotente                          |
| Versões legadas / versões gerais                       |                     1 |                     1 | mesmo UUID                                |
| Itens legados / itens gerais                           |                     1 |                     1 | mesmo UUID e preços `20,1250` / `25,3750` |
| Séries legadas / séries gerais                         |                     1 |                     1 | mesmo UUID                                |
| Cálculos / itens / clientes vinculados                 |             1 / 1 / 1 |             1 / 1 / 1 | preservados                               |
| Totais mínimo / normal do cálculo                      | `40,2500` / `50,7500` | `40,2500` / `50,7500` | preservados                               |
| Itens ou clientes de cálculo órfãos                    |                     0 |                     0 | sem órfãos                                |

O rollback operacional planejado foi ensaiado por consultas equivalentes às leituras da aplicação
anterior depois de todas as migrations. Perfil ativo, versão, item, série, cálculo e vínculo com
cliente continuaram legíveis pelas tabelas e FKs legadas. Em paralelo, as novas relações apontaram
para os mesmos UUIDs. Portanto, o rollback permanece a troca para a versão anterior da aplicação,
mantendo o schema expandido. Não foi executada reversão destrutiva de schema, conforme a estratégia
documentada em `implementation-notes.md`.

## Permissões, auditoria e preservação

- A base migrada contém 15 permissões e três papéis com permissões associadas.
- A tabela de auditoria permaneceu disponível com seus 35 eventos existentes.
- Os testes de integração confirmam `matrix.view`/`matrix.manage`, `price.view` e `order.access`, além
  de ator e data nas mutações administrativas de listas.
- O histórico de lista, a versão ativa, as FKs duplas durante a compatibilidade e os totais decimais
  foram preservados no ensaio.

## Quality gate e smoke tests

| Verificação                | Resultado                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run format:check`     | aprovado; todos os arquivos formatados                            |
| `npm run lint`             | aprovado                                                          |
| `npm run typecheck`        | aprovado                                                          |
| `npm run build`            | aprovado, incluindo geração do Prisma Client e bundle de produção |
| `npm test`                 | 30 arquivos e 140 testes aprovados                                |
| `npm run test:integration` | 7 arquivos e 46 testes aprovados                                  |
| `npm run test:e2e`         | 16 testes aprovados                                               |

Os 16 E2E incluem os smoke tests de Clientes, Listas, Calcular, Busca/Detalhe e Pedidos. A Busca foi
validada no estado vazio real, sem cálculo demonstrativo nem detalhe fictício; os fluxos de detalhe
continuam dependentes de um cálculo persistido real. Também foram exercitados administração de
usuários, autenticação e compatibilidade de comissões.

## Evidência dos 16 critérios de aceite

1. **Tipos sem depender do arquivo:** o parser despacha pelo tipo informado e os E2E separam as
   seções de listas.
2. **Importação dos dois tipos:** testes locais cobrem os quatro arquivos estruturados e os cinco
   avulsos; integração confirma e persiste ambos os formatos.
3. **Histórico imutável:** reconciliação preservou UUIDs, versão, preços, FKs e totais; testes cobrem
   ativação sequencial sem reescrita histórica.
4. **Simulação sem cliente:** unitário, integração contratual e E2E permitem prévia sem cliente.
5. **Salvamento com cliente ativo:** serviço e contrato HTTP rejeitam ausência, UUID inválido e
   cliente inativo.
6. **Classe compatível:** serviço e E2E rejeitam cliente sem classe ou com classe incompatível.
7. **Somente listas autorizadas:** política de listas, catálogo e cotação rejeitam classe ou segmento
   incompatível, inclusive ID manipulado.
8. **Escolha manual:** E2E de Pedidos cobre escolha explícita entre zero, uma e várias listas.
9. **Versão real no catálogo:** serviço entrega produtos pela versão ativa persistida; a limpeza do
   protótipo impede catálogo e preços fixos no bundle.
10. **Quantidade total mista:** testes somam kits e produtos sem estrutura em um único total.
11. **Limites de faixa:** testes cobrem exatamente 49, 50, 99 e 100.
12. **Invalidação por quantidade:** serviço e E2E bloqueiam a finalização ao sair da faixa.
13. **Recálculo no backend:** integração de cotação descarta preços enviados pelo navegador.
14. **IPI sem duplicação:** teste decimal de carrinho misto confirma que o IPI já incluído não é
    acrescentado novamente.
15. **Lista opcional ausente:** E2E cobre zero, uma e várias listas e o cálculo permanece bloqueado
    de forma segura apenas quando não há lista aplicável ao seu próprio fluxo.
16. **Usuário e data na administração:** integração confirma auditoria nas mutações de listas; o
    ensaio preservou a tabela e os eventos históricos.

## Limitações remanescentes

- A base local não possuía histórico comercial de matrizes e cálculos; por segurança, a prova de
  preservação usou uma massa sanitizada representativa. Antes do corte em produção, as mesmas
  consultas devem ser executadas sobre uma cópia recente com o volume e o histórico reais.
- Os dois clientes sem segmento legado continuam sem classificação automática, deliberadamente.
- A aplicação antiga não conhece listas `STANDALONE_PRODUCT`; em rollback elas permanecem
  preservadas no schema novo, mas invisíveis até a aplicação nova ser restaurada.
- O ensaio não mede tempo sobre infraestrutura ou volume de produção; `13,01 s` é apenas a referência
  desta cópia local.
