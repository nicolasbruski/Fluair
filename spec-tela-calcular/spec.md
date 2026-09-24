# Especificação — Listas de preço por classe e segmento

## 1. Status do documento

- Status: requisitos funcionais consolidados para planejamento
- Data: 2026-09-09
- Próxima etapa: derivar um `tasks.md` com tarefas pequenas e verificáveis
- Escopo desta etapa: especificação somente; nenhuma implementação está incluída

## 2. Objetivo

Evoluir o sistema de formação de preço para trabalhar com dois tipos distintos de lista:

1. listas de componentes usadas para calcular kits de freio com estrutura;
2. listas de produtos sem estrutura, usadas como catálogo e referência de preço no carrinho de pedidos.

As listas devem ser configuráveis, versionadas e relacionadas à classificação comercial do cliente. Os arquivos atualmente disponíveis em `infos-calcular/` são dados de teste: servem para validar formatos e fluxos, mas seus produtos, quantidades e valores não devem ser codificados como regras fixas.

## 3. Fontes consideradas

- transcrições dos dois áudios fornecidos pela cliente;
- `infos-calcular/foto-classes.jpeg`;
- quatro planilhas de teste de itens com estrutura;
- cinco planilhas de teste de itens sem estrutura;
- implementação atual de clientes, matrizes, cálculo e pedidos;
- decisões confirmadas na conversa que originou esta especificação.

## 4. Glossário

### 4.1 Classe do cliente

Classificação usada para determinar quais listas de componentes podem ser utilizadas no cálculo de kits de freio.

Classes inicialmente previstas:

- Implementador;
- Revenda;
- Consumidor Final;
- Exportação.

### 4.2 Segmento do cliente

Classificação comercial usada para determinar quais listas de produtos sem estrutura podem ser utilizadas no carrinho.

O segmento já existe no cadastro atual, mas hoje é texto livre. A implementação de preço deve usar identificadores normalizados e associações persistidas, sem depender de comparações frágeis entre textos.

### 4.3 Lista com estrutura

Lista com preço mínimo e preço normal/máximo dos componentes usados na composição de kits de freio.

### 4.4 Lista sem estrutura

Lista com produtos vendáveis diretamente no carrinho. Cada produto possui um único valor de referência, sem composição e sem par mínimo/máximo.

### 4.5 Versão ativa

Versão imutável de uma lista que deve ser usada em novas simulações, cálculos e consultas de preço. Versões anteriores permanecem disponíveis para preservar o histórico.

## 5. Decisões confirmadas

1. Existem dois tipos de lista e dois tratamentos de preço distintos.
2. O preço `Normal` das planilhas com estrutura corresponde ao preço máximo mencionado pela cliente.
3. A lista sem estrutura atualmente chamada `Implementador` representa a lista de Indústria.
4. Não é obrigatório possuir agora uma lista sem estrutura específica para Consumidor Final/Frotista.
5. A última faixa de quantidade começa em 100 unidades: `100+`.
6. O IPI informado nas listas sem estrutura já está incluído no valor do produto e não deve ser somado novamente.
7. A simulação de kit pode ser realizada sem cliente.
8. Para salvar um cálculo, a seleção de um cliente será obrigatória.
9. A escolha da lista será manual.
10. O sistema deve apresentar somente listas autorizadas para a classe ou o segmento aplicável.
11. Um segmento pode ter acesso a mais de uma lista.
12. Uma lista destinada a segmentos específicos não pode ser utilizada por clientes de segmentos não autorizados.
13. As faixas de quantidade consideram a soma das quantidades de todas as linhas do pedido, incluindo kits e produtos sem estrutura.
14. Os arquivos e valores atuais são apenas de teste e serão substituídos no futuro.

### 5.1 Configuração inicial representada pelos arquivos de teste

As associações abaixo descrevem a intenção apresentada nos materiais de referência. Elas devem ser cadastradas como dados configuráveis, não implementadas como condicionais fixas.

Listas com estrutura:

| Lista de teste   | Classe atendida  |
| ---------------- | ---------------- |
| Implementador    | Implementador    |
| Revenda          | Revenda          |
| Consumidor Final | Consumidor Final |
| Exportação       | Exportação       |

Listas sem estrutura:

| Lista de teste                             | Segmentos inicialmente relacionados                    | Faixa                          |
| ------------------------------------------ | ------------------------------------------------------ | ------------------------------ |
| Implementador, interpretada como Indústria | Indústria                                              | Sem faixa definida no material |
| Revenda até 49 peças                       | Autopeças, Posto de Serviço, Distribuidor e Autorizada | Até 49                         |
| Revenda 50 a 99 peças                      | Autopeças, Posto de Serviço, Distribuidor e Autorizada | 50 a 99                        |
| Revenda 100+                               | Autopeças, Posto de Serviço, Distribuidor e Autorizada | 100 ou mais                    |
| Exportação                                 | Exportação                                             | Sem faixa definida no material |

Não há exigência atual de uma lista sem estrutura para Consumidor Final/Frotista. O modelo deve permitir seu cadastro futuro sem exigir alteração de código.

## 6. Escopo funcional

### 6.1 Incluído

- inclusão da classe no cadastro de clientes;
- normalização da classificação comercial necessária à precificação;
- criação e administração de listas de preço configuráveis;
- associação de listas com classes e segmentos;
- versionamento e ativação de listas;
- importação dos dois formatos de planilha;
- simulação e salvamento de kits com validação de cliente;
- catálogo real de produtos sem estrutura;
- escolha manual de lista no carrinho;
- validação das faixas pela quantidade total do pedido;
- preservação da versão e dos preços usados em registros históricos;
- autorização, auditoria e testes correspondentes.

### 6.2 Fora de escopo desta implementação

- cadastro manual completo de produtos fora do fluxo de importação;
- definição do documento final do pedido;
- envio de pedido por e-mail;
- fluxo completo de aprovação, cancelamento ou faturamento de pedidos;
- regras novas de comissão;
- exigência de que todas as classes e segmentos tenham uma lista ativa;
- utilização dos valores atuais das planilhas como dados definitivos de produção.

## 7. Requisitos funcionais — clientes

### RF-CLI-001 — Classe do cliente

O cadastro do cliente deve possuir uma classe comercial além do segmento.

### RF-CLI-002 — Manutenção da classe

A classe deve participar da criação, edição, consulta, listagem e exportação de clientes.

### RF-CLI-003 — Identificadores normalizados

Classe e segmento usados na seleção de preço devem possuir identificadores estáveis. Rótulos exibidos ao usuário podem mudar sem quebrar associações existentes.

### RF-CLI-004 — Dados incompletos

Clientes sem a classificação exigida podem continuar cadastrados e disponíveis para os módulos que não dependem de preço, mas não podem ser usados para salvar um cálculo ou concluir uma seleção de preço que dependa do dado ausente.

### RF-CLI-005 — Compatibilidade com comissões

A evolução do cadastro não pode remover nem alterar silenciosamente os campos de segmento, vendedor e representante usados pelo sistema de comissões.

## 8. Requisitos funcionais — listas de preço

### RF-LIS-001 — Tipos de lista

Cada lista deve possuir um tipo explícito:

- `KIT_COMPONENT`: componentes de kit com preços mínimo e normal/máximo;
- `STANDALONE_PRODUCT`: produtos sem estrutura com preço único.

O nome técnico final pode variar, mas a distinção deve existir no domínio e no banco.

### RF-LIS-002 — Configuração da lista

Cada definição de lista deve armazenar pelo menos:

- identificador;
- código estável;
- nome de exibição;
- tipo;
- situação ativa/inativa;
- regra de público aplicável;
- faixa de quantidade, quando houver;
- referência para sua versão ativa;
- datas de criação e atualização.

### RF-LIS-003 — Lista de componentes por classe

Uma lista do tipo `KIT_COMPONENT` deve ser vinculada a uma ou mais classes autorizadas. Somente clientes dessas classes podem ser vinculados ao cálculo produzido com a lista.

### RF-LIS-004 — Lista de produtos por segmento

Uma lista do tipo `STANDALONE_PRODUCT` deve ser vinculada a um ou mais segmentos autorizados. Um segmento pode estar associado a diversas listas.

### RF-LIS-005 — Escolha manual

Quando houver mais de uma lista autorizada e aplicável, o usuário deve escolher a lista manualmente. O sistema não deve trocar silenciosamente para outra lista.

### RF-LIS-006 — Faixa de quantidade

Uma lista pode definir limite mínimo e máximo de quantidade. As faixas iniciais de referência são:

- até 49 unidades;
- de 50 a 99 unidades;
- 100 unidades ou mais.

As faixas devem ser dados configuráveis da lista, e não condicionais fixas espalhadas pelo código.

### RF-LIS-007 — Quantidade considerada

A quantidade usada para verificar a faixa deve ser:

`quantidadeTotalPedido = soma da quantidade de todas as linhas do pedido`

A soma inclui kits e produtos sem estrutura.

### RF-LIS-008 — Listas opcionais

O sistema deve funcionar mesmo quando uma classe ou um segmento ainda não possuir uma lista configurada. A ausência deve ser mostrada claramente e deve impedir somente a operação que depende daquela lista.

## 9. Requisitos funcionais — versionamento

### RF-VER-001 — Versões imutáveis

Cada importação confirmada deve criar uma nova versão imutável da lista. Itens de uma versão existente não podem ser alterados em lugar.

### RF-VER-002 — Uma versão ativa por lista

Cada definição de lista pode possuir no máximo uma versão ativa.

### RF-VER-003 — Ativação transacional

A criação da versão, gravação dos itens e troca da versão ativa devem ocorrer em uma transação.

### RF-VER-004 — Arquivo original

Cada versão deve preservar:

- nome do arquivo;
- tipo MIME;
- tamanho;
- hash;
- conteúdo original;
- quantidade de itens;
- usuário responsável;
- data de importação.

### RF-VER-005 — Importação duplicada

O sistema deve detectar o reenvio do mesmo arquivo para a mesma lista e impedir uma versão acidentalmente duplicada, retornando mensagem clara.

### RF-VER-006 — Histórico independente

Alterar ou ativar uma nova versão não pode recalcular nem modificar automaticamente cálculos ou pedidos históricos.

## 10. Requisitos funcionais — importação

### 10.1 Fluxo comum

1. O usuário autorizado seleciona a definição de lista.
2. O sistema já conhece o tipo esperado pela lista.
3. O usuário seleciona um arquivo `.xls` ou `.xlsx`.
4. O backend valida arquivo, planilha, cabeçalhos, linhas e valores.
5. A interface exibe um resumo de validação.
6. O usuário confirma a importação.
7. O backend cria e ativa a nova versão.

O tipo da lista não deve ser inferido somente pelo nome do arquivo.

### 10.2 Formato com estrutura

O importador de `KIT_COMPONENT` deve aceitar o formato de teste atual:

- código do componente;
- descrição;
- valor mínimo;
- valor normal/máximo.

Deve reconhecer variações controladas de cabeçalho, incluindo `Valor Mínimo`, `Tabela Mínima`, `Tabela Diferenciada`, `Valor Normal`, `Tabela Normal` e equivalentes documentados.

### 10.3 Formato sem estrutura

O importador de `STANDALONE_PRODUCT` deve aceitar:

- código;
- descrição;
- referência;
- valor;
- IPI.

O IPI deve ser preservado como dado informativo e de auditoria, mas não deve ser acrescentado novamente ao preço.

### 10.4 Regras de validação

O importador deve:

- ignorar linhas completamente vazias;
- tratar códigos como texto;
- normalizar quebras de linha externas em código e descrição;
- rejeitar código vazio ou inválido;
- rejeitar código duplicado na mesma versão;
- rejeitar preço não numérico ou negativo;
- aceitar quantidade variável de linhas;
- rejeitar arquivo sem itens válidos;
- rejeitar formato incompatível com o tipo da lista;
- informar linha e coluna sempre que possível;
- emitir aviso quando o preço mínimo for maior que o normal/máximo;
- não fixar produtos, preços ou número de linhas encontrados nos arquivos de teste.

O aviso de mínimo maior que normal/máximo não deve, por si só, definir uma regra comercial definitiva enquanto os arquivos forem de teste.

## 11. Requisitos funcionais — simulação e cálculo de kits

### RF-CAL-001 — Entrada

A simulação de kit deve receber:

- folha de processo Korp;
- lista de componentes escolhida manualmente.

O cliente não é obrigatório para gerar a prévia.

### RF-CAL-002 — Matriz usada

O backend deve usar a versão ativa da lista selecionada no início da simulação e devolver seu identificador e sua versão na prévia.

### RF-CAL-003 — Regra de cálculo

Para cada item da composição:

1. localizar o código na versão da lista;
2. obter preço mínimo e preço normal/máximo;
3. multiplicar cada preço pela quantidade do componente;
4. acumular os dois totais;
5. marcar item sem preço quando o código não existir ou quando ambos os preços forem zero.

### RF-CAL-004 — Prévia

A prévia deve mostrar:

- código e descrição do kit;
- lista e versão utilizadas;
- classe atendida;
- componentes e quantidades;
- preços unitários;
- totais por item;
- totais mínimo e normal/máximo;
- quantidade de itens sem preço;
- aviso de que a prévia ainda não está salva.

### RF-CAL-005 — Cliente obrigatório no salvamento

Ao salvar, o usuário deve selecionar um cliente ativo. Não deve existir salvamento definitivo sem cliente.

### RF-CAL-006 — Validação da classe no backend

O backend deve recarregar o cliente pelo identificador e validar se sua classe está autorizada para a lista utilizada na prévia.

Se a classe for incompatível ou estiver ausente, o salvamento deve ser bloqueado. O sistema deve pedir que o usuário selecione uma lista adequada e gere uma nova prévia.

### RF-CAL-007 — Mudança da versão ativa

Se a versão ativa mudar entre a prévia e o salvamento, o salvamento deve ser bloqueado e a simulação deve ser refeita.

### RF-CAL-008 — Histórico do cálculo

O cálculo salvo deve fotografar lista, versão, composição, preços, totais, arquivo Korp, cliente, classe e usuário responsável.

### RF-CAL-009 — Cálculo existente

O comportamento atual de versionar recálculos e preservar versões anteriores deve continuar. Quando aplicável, vincular um cliente a um cálculo existente não deve duplicar desnecessariamente toda a composição.

## 12. Requisitos funcionais — produtos sem estrutura

### RF-PRO-001 — Origem do catálogo

Produtos sem estrutura devem ser originados das versões importadas das listas `STANDALONE_PRODUCT`. A constante demonstrativa `PEDIDO_PRODUTOS` não pode continuar como fonte do catálogo real.

### RF-PRO-002 — Identidade do produto

O código deve identificar o produto. Descrição e referência podem ser mantidas como identificação conhecida mais recente, sem retirar das versões de lista a fotografia original importada.

### RF-PRO-003 — Preço fora do produto

O preço não deve ser armazenado como atributo global e atual do produto. Ele pertence ao item de uma versão de lista.

### RF-PRO-004 — Produto chamado “kit” sem estrutura

A classificação entre com estrutura e sem estrutura deve vir do tipo da lista e do fluxo de negócio, não de palavras presentes na descrição do produto.

## 13. Requisitos funcionais — carrinho de pedidos

### RF-PED-001 — Cliente antes da lista

Para consultar e escolher listas de produtos sem estrutura, o usuário deve selecionar primeiro um cliente ativo.

### RF-PED-002 — Listas permitidas

Depois da seleção do cliente, a interface deve apresentar somente listas:

- do tipo `STANDALONE_PRODUCT`;
- ativas;
- autorizadas para o segmento do cliente;
- compatíveis com a quantidade total atual, quando possuírem faixa.

### RF-PED-003 — Seleção manual da lista

O usuário deve escolher manualmente uma das listas disponíveis. Nenhuma lista deve ser escolhida ou trocada silenciosamente.

### RF-PED-004 — Catálogo da lista

A busca de produtos deve consultar os itens da versão ativa da lista selecionada e permitir pesquisa por código, descrição e referência.

### RF-PED-005 — Soma de quantidades

O total usado nas faixas deve somar as quantidades de todos os itens do carrinho, incluindo:

- kits calculados;
- produtos sem estrutura.

### RF-PED-006 — Mudança de faixa

Sempre que um item for adicionado, removido ou tiver sua quantidade alterada, a faixa deve ser reavaliada.

Se a lista selecionada deixar de ser compatível:

- o sistema deve exibir aviso claro;
- o usuário deve escolher manualmente uma lista válida;
- a finalização deve permanecer bloqueada;
- nenhuma troca automática silenciosa deve ocorrer.

### RF-PED-007 — Preço de referência

O preço unitário do produto sem estrutura deve vir do item da versão da lista selecionada. O IPI não deve ser acrescentado ao subtotal porque já está incluído no valor.

### RF-PED-008 — Validação no servidor

Antes de concluir uma operação persistente, o backend deve recalcular:

- cliente e segmento atuais;
- listas autorizadas;
- versão ativa;
- quantidade total;
- faixa aplicável;
- existência dos produtos;
- preços unitários;
- subtotais e total.

Valores monetários ou autorizações calculados somente no navegador não são confiáveis.

### RF-PED-009 — Alteração do cliente

Ao trocar o cliente, a lista selecionada deve ser invalidada até que seja novamente validada para o novo segmento. Produtos indisponíveis na nova lista devem ser destacados e impedir a finalização.

## 14. Modelo de dados conceitual

Os nomes abaixo são indicativos. O desenho final pode adaptar as tabelas existentes desde que preserve as regras.

### 14.1 Customer

Adicionar:

- `classId` ou `classCode`;
- relação com uma entidade normalizada de classe, se adotada.

Manter:

- segmento;
- vendedor;
- representante;
- observações;
- situação e histórico existentes.

### 14.2 CustomerClass

Campos sugeridos:

- `id`;
- `code` único;
- `name`;
- `active`;
- datas.

### 14.3 CustomerSegment

Recomendado para evitar que a lógica de preço dependa de texto livre:

- `id`;
- `code` único;
- `name`;
- `active`;
- datas.

A adoção deve preservar compatibilidade e permitir migração dos segmentos existentes.

### 14.4 PriceList

Definição estável da lista:

- `id`;
- `code` único;
- `name`;
- `type`;
- `minimumOrderQuantity` opcional;
- `maximumOrderQuantity` opcional, com `null` representando ausência de teto;
- `activeVersionId` opcional;
- `active`;
- datas.

### 14.5 PriceListClass

Associação entre listas de componentes e classes autorizadas.

Restrição esperada:

- chave única por lista e classe.

### 14.6 PriceListSegment

Associação entre listas de produtos sem estrutura e segmentos autorizados.

Restrições esperadas:

- chave única por lista e segmento;
- suporte a várias listas por segmento e vários segmentos por lista.

### 14.7 PriceListVersion

Campos sugeridos:

- `id`;
- `priceListId`;
- número sequencial da versão;
- metadados e conteúdo do arquivo;
- hash;
- quantidade de itens;
- usuário importador;
- data.

### 14.8 PriceListItem

Campos comuns:

- `id`;
- `priceListVersionId`;
- `productCode`;
- `description`;
- `sourceRow`;
- `rawData` opcional.

Campos de lista com estrutura:

- `minimumPrice`;
- `normalPrice`.

Campos de lista sem estrutura:

- `reference`;
- `unitPrice`;
- `ipiRate` informativo;
- marcador explícito de que o IPI já está incluído, se necessário para auditoria.

Os campos não aplicáveis podem ser nulos, mas validações de domínio devem exigir o conjunto correto conforme o tipo da lista.

### 14.9 Compatibilidade com as tabelas atuais

A migração deve preservar:

- versões existentes de matrizes;
- itens existentes;
- cálculos e seus relacionamentos;
- referências usadas no histórico.

É aceitável generalizar as tabelas atuais de matriz ou introduzir novas tabelas e migrar os dados. Não é aceitável apagar o histórico ou reconstruí-lo com preços atuais.

## 15. Resolução de preços

### 15.1 Kit em simulação

1. Receber lista escolhida e folha Korp.
2. Confirmar que a lista é do tipo correto e possui versão ativa.
3. Fixar a versão para toda a operação.
4. Calcular os componentes.
5. Retornar a prévia sem exigir cliente.

### 15.2 Kit no salvamento

1. Recarregar cliente ativo.
2. Recarregar lista e versão esperada.
3. Validar classe do cliente.
4. Confirmar que a versão não mudou.
5. Recalcular no servidor.
6. Persistir cálculo, itens, cliente e auditoria em transação.

### 15.3 Produto sem estrutura no pedido

1. Recarregar cliente e segmento.
2. Somar todas as quantidades do pedido.
3. Verificar se a lista escolhida está autorizada para o segmento.
4. Verificar se a lista é compatível com a quantidade total.
5. Fixar a versão ativa da lista.
6. Localizar cada produto na versão.
7. Aplicar o preço unitário armazenado, sem somar IPI.
8. Recalcular totais.

## 16. Interface

### 16.1 Tela Calcular

Deve:

- substituir os três perfis fixos por listas de componentes vindas da API;
- permitir escolha manual da lista;
- mostrar classe atendida e versão ativa;
- continuar permitindo prévia sem cliente;
- exigir cliente ao salvar;
- explicar incompatibilidades de classe;
- distinguir claramente preço mínimo de preço normal/máximo.

### 16.2 Administração de listas

Deve separar visualmente:

- listas para cálculo de kits;
- listas para produtos do carrinho.

Para cada lista, mostrar:

- tipo;
- nome;
- classes ou segmentos autorizados;
- faixa;
- versão ativa;
- arquivo, quantidade de itens, data e responsável;
- ação de importar nova versão;
- histórico disponível.

### 16.3 Tela de Clientes

Deve incluir classe nos formulários, tabela, filtros e exportação. Segmento continua disponível e deve ser compatível com a associação de listas.

### 16.4 Tela de Pedidos

Deve:

- manter seleção de cliente real;
- exibir seletor manual de lista após o cliente;
- carregar catálogo real da versão ativa;
- buscar por código, descrição ou referência;
- exibir quantidade total usada na faixa;
- avisar quando a lista ficar incompatível;
- impedir finalização enquanto houver incompatibilidade;
- remover dependência da lista fixa demonstrativa.

## 17. API — capacidades necessárias

A definição final dos caminhos deve seguir o padrão `/api/v1`, cobrindo pelo menos:

- listar definições de lista e versões;
- criar e editar metadados de lista;
- configurar classes e segmentos autorizados;
- importar e ativar nova versão;
- consultar listas permitidas para cliente e contexto;
- pesquisar produtos na versão ativa de uma lista;
- gerar prévia de cálculo de kit;
- salvar cálculo com cliente obrigatório;
- validar ou cotar um carrinho no backend.

Respostas de preço devem identificar a lista e a versão utilizadas.

## 18. Permissões e auditoria

### 18.1 Permissões

As permissões atuais podem ser reaproveitadas inicialmente:

- `matrix.view` para consultar listas e versões;
- `matrix.manage` para configurar, importar e ativar;
- `calculation.create` para simular e salvar kits;
- `customer.view` e `customer.manage` para clientes;
- `order.access` para montar pedidos;
- `price.view` e `price.override` para visualização e negociação.

Se a separação entre lista de kit e lista de carrinho exigir controle distinto, novas permissões devem ser adicionadas explicitamente, com atualização de papéis, frontend e backend.

### 18.2 Auditoria obrigatória

Registrar pelo menos:

- criação e alteração de lista;
- mudança de classes e segmentos autorizados;
- importação e ativação de versão;
- salvamento e recálculo de kit;
- vínculo do cálculo ao cliente;
- futura cotação/finalização persistente do pedido;
- responsável, data, entidade e metadados relevantes.

## 19. Erros de domínio esperados

Devem existir mensagens claras para situações como:

- lista não encontrada ou inativa;
- lista sem versão ativa;
- tipo de lista incompatível com a operação;
- arquivo ou cabeçalho inválido;
- código duplicado;
- preço inválido;
- cliente ausente no salvamento;
- cliente desativado;
- cliente sem classe ou segmento necessário;
- classe não autorizada para a lista do kit;
- segmento não autorizado para a lista do carrinho;
- lista incompatível com a quantidade total;
- produto não encontrado na versão escolhida;
- versão ativa alterada durante a operação;
- tentativa de usar preço calculado apenas no navegador.

## 20. Requisitos não funcionais

- cálculos monetários devem usar aritmética decimal no backend;
- códigos devem permanecer strings;
- operações de importação e salvamento devem ser transacionais;
- arquivos e históricos comerciais não podem ser sobrescritos;
- respostas mutáveis devem manter autenticação, autorização e auditoria existentes;
- o frontend deve tratar carregamento, lista vazia, erro recuperável e falta de permissão;
- nenhuma regra pode depender do nome específico dos arquivos de teste;
- nenhuma regra pode depender da ordem fixa das listas;
- nenhuma regra de autorização pode existir somente no frontend;
- índices e consultas devem suportar busca por código, descrição, referência, classe e segmento.

## 21. Migração e compatibilidade

1. Criar as novas estruturas sem apagar os dados existentes.
2. Cadastrar as classes iniciais.
3. Mapear os perfis/matrizes atuais para listas de componentes equivalentes.
4. Preservar seus identificadores históricos ou manter uma relação de migração estável.
5. Adicionar classe aos clientes sem inventar valores desconhecidos.
6. Permitir estado temporário “não classificado”.
7. Migrar ou normalizar segmentos existentes com relatório de divergências.
8. Importar as planilhas de teste somente em ambiente apropriado.
9. Não tratar listas ausentes como erro global do sistema.
10. Atualizar documentação e dados estruturais do seed.

## 22. Estratégia de testes

### 22.1 Testes unitários

- parser de lista com estrutura;
- parser de lista sem estrutura;
- aliases de cabeçalho;
- códigos como texto;
- linhas vazias e quebras de linha;
- valores brasileiros;
- duplicidade e preços inválidos;
- aviso de mínimo maior que normal;
- cálculo decimal do kit;
- cálculo da quantidade total do pedido;
- limites 49, 50, 99 e 100;
- autorização por classe e segmento;
- IPI não somado novamente.

### 22.2 Testes de integração

- importação e ativação transacional;
- preservação da versão anterior;
- salvamento bloqueado sem cliente;
- salvamento bloqueado por classe incompatível;
- salvamento bloqueado após mudança da versão ativa;
- consulta de listas autorizadas para o segmento;
- rejeição de lista não autorizada enviada diretamente à API;
- revalidação de faixa e preços pelo backend.

### 22.3 Testes de ponta a ponta

- simular kit sem cliente e salvar com cliente compatível;
- tentar salvar com cliente incompatível;
- selecionar cliente e escolher manualmente uma lista autorizada;
- não exibir lista de outro segmento;
- adicionar kits e produtos até mudar de 99 para 100 unidades;
- invalidar a lista anterior e exigir nova escolha;
- pesquisar produto real por código, descrição e referência;
- confirmar que o IPI não é somado ao total;
- confirmar que versões históricas mantêm seus preços.

## 23. Critérios de aceite

1. O sistema diferencia listas com e sem estrutura sem depender do nome do arquivo.
2. Uma planilha válida de cada tipo pode ser importada e versionada.
3. Novas versões não alteram cálculos históricos.
4. A simulação de kit funciona sem cliente.
5. Nenhum cálculo é salvo sem cliente ativo.
6. Um cálculo não pode ser salvo para classe incompatível com a lista utilizada.
7. Clientes visualizam ou utilizam somente listas autorizadas para sua classificação.
8. A escolha entre listas autorizadas é manual.
9. Produtos sem estrutura são carregados de uma versão real de lista, e não de dados fixos no frontend.
10. A faixa usa a soma das quantidades de kits e produtos sem estrutura.
11. Os limites 49, 50, 99 e 100 produzem a faixa correta.
12. A mudança de quantidade invalida uma lista incompatível e bloqueia a finalização.
13. O backend recalcula preços e totais sem confiar nos valores enviados pelo navegador.
14. O IPI não é acrescentado novamente ao preço.
15. Ausência de uma lista opcional não impede o funcionamento das demais.
16. Toda operação administrativa relevante identifica usuário e data.

## 24. Direção para o futuro `tasks.md`

O plano de implementação deve ser dividido em recortes pequenos, preferencialmente nesta ordem:

1. entidades e migração de classe/segmento;
2. entidades versionadas de lista;
3. serviços de autorização de listas;
4. parser de lista com estrutura;
5. parser de lista sem estrutura;
6. importação e ativação;
7. APIs e tela administrativa;
8. cálculo de kit com lista dinâmica;
9. cliente obrigatório e validação no salvamento;
10. catálogo real de produtos sem estrutura;
11. seleção manual de lista no pedido;
12. quantidade total e faixas;
13. validação de carrinho no backend;
14. remoção dos dados demonstrativos afetados;
15. testes, documentação e verificação final.

Cada tarefa deverá indicar dependências, arquivos prováveis, testes exigidos e critério objetivo de conclusão.

## 25. Pendências

Não há decisão funcional bloqueadora conhecida para decompor esta especificação em tarefas. Detalhes técnicos como nomes finais de tabelas, rotas e componentes devem ser decididos durante o `tasks.md`, respeitando os requisitos e critérios de aceite deste documento.
