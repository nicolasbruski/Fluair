# Tela de Pedidos

## Identificação

- Rota: `/pedidos/novo`
- Permissões: `order.access`, `price.view` e permissões de cliente conforme a ação
- Estado: montagem, aprovação de exceção, confirmação, persistência idempotente e envio assíncrono implementados

## Catálogo

Sem cliente selecionado, o drawer mostra:

- todos os produtos avulsos das versões ativas de todas as listas ativas;
- kits padrões ativos;
- nenhum kit exclusivo de cliente.

Depois de selecionar o cliente, mostra:

- produtos avulsos das listas vinculadas ao segmento atual;
- kits padrões compatíveis com a classe;
- kits calculados vinculados exclusivamente ao cliente selecionado.

Classe e segmento são avaliados de forma independente: a ausência de classe não bloqueia
produtos avulsos quando o cliente possui segmento ativo, e a ausência de segmento não bloqueia
kits quando o cliente possui classe ativa.

Componentes internos dos kits nunca aparecem como ofertas no Pedido. O mesmo código avulso em
listas diferentes aparece uma única vez. A faixa de referência usa o menor e o maior valor entre
as versões ativas das listas permitidas; ao selecionar um cliente, somente as listas vinculadas ao
segmento atual participam da faixa.

## Apresentação e carrinho

Cards do drawer e linhas do carrinho mostram a miniatura atual do produto ou kit. A ampliação da
imagem não adiciona o item, funciona por teclado e usa placeholder quando a foto não existe ou não
carrega. A cotação reafirma a referência atual, mas imagem não participa da chave do carrinho,
quantidade, preço, imposto, disponibilidade ou total.

Com um cliente selecionado, cada card do drawer também mostra o valor da última venda do item para
esse cliente, com número e data do pedido no texto auxiliar. Enquanto a consulta está em andamento,
sem resultado ou indisponível, o card informa o estado correspondente.

No drawer, cada produto avulso exibe o valor de todas as listas compatíveis, identificado pela faixa
compacta de quantidade da lista (por exemplo, `50-99: R$ 25,50` e `100+: R$ 22,00`). Listas sem
faixa numérica usam o próprio nome, como `Exportação: R$ 25,50` e `Indústria: R$ 22,00`. Kits
exibem mínimo e máximo, sem composição. Os valores por lista/faixa dos produtos avulsos permanecem
visíveis quando o usuário aciona o switch de ocultar preços; o switch continua afetando os demais
preços de referência. Cada valor por lista/faixa é clicável e adiciona ao carrinho exatamente o
preço, a versão e os impostos da lista escolhida.
As descrições exibidas no drawer e no carrinho removem o trecho legado `Usuario: <nome>` quando ele
vier incorporado ao texto.
No carrinho, cada produto avulso apresenta uma linha para cada lista compatível. A linha identifica
a lista e mostra, lado a lado e com cor neutra, o menor `Valor` disponível entre as listas como
mínimo e o `Valor` daquela lista como máximo. As listas aparecem uma abaixo da outra. O maior valor
entre elas é a referência inicial da linha e identifica a versão usada na validação; o usuário pode
informar o preço negociado sem alterar a referência armazenada. Kits também usam cor neutra nas
referências. Cada oferta avulsa carrega PIS, Cofins, ICMS e IPI da versão da respectiva lista.
No carrinho, os quatro impostos começam marcados, possuem alíquota somente leitura e podem ser
aplicados individualmente. O preço final unitário é o preço-base acrescido da soma simples dos
impostos marcados, cada um calculado sobre o preço-base; o subtotal multiplica esse preço final pela
quantidade. Trocar a lista substitui as alíquotas e recalcula o valor. Kits usam as alíquotas únicas
da versão imutável da lista com estrutura; arquivos antigos sem essas colunas usam alíquota zero.

Com um cliente selecionado, cada linha do carrinho consulta e mostra o último preço unitário
efetivamente negociado para aquele cliente. A consulta considera somente pedidos `SUBMITTED`: para
produtos avulsos usa o código do produto e, para kits, a versão exata do cálculo. O histórico é
informativo, inclui número e data do pedido e não substitui o preço de referência nem preenche
automaticamente o preço negociado atual.

Cada usuário mantém uma fila persistente com até cinco pedidos não finalizados, um por cliente. Ao
trocar de cliente, o carrinho atual é salvo e o carrinho existente do cliente escolhido é restaurado
na mesma operação. Ao entrar um sexto cliente, o pedido menos recente é removido automaticamente e
o novo passa a ocupar o início da fila. O pedido atual e o pedido retomado são protegidos durante a
troca.

A fila aparece somente como abas encaixadas no topo do card de cliente, como uma pasta, ordenadas da
atividade mais recente para a mais antiga. Cada aba exibe o código e a primeira palavra com letras
do nome do cliente; o nome completo permanece no título e no rótulo acessível. Em telas estreitas,
as abas permitem rolagem horizontal. Cada aba mostra a quantidade de itens e pode ser retomada ou
descartada individualmente.

Ao fechar o cliente pelo botão **X**, um carrinho em montagem é salvo na fila antes de
a tela limpar o cliente e os itens. Se o salvamento falhar, cliente e carrinho permanecem abertos
para evitar perda de dados. Sem itens no carrinho, o **X** apenas remove a seleção do cliente.

Itens, quantidades, preços, impostos e observações também acionam salvamento automático agrupado.
Se o último item for removido, a aba vazia deixa de ocupar espaço na fila.

A navegação **Gerar pedido** da tela de Clientes segue a mesma regra: primeiro salva ou troca
atomicamente o pedido que já estava em montagem e somente depois seleciona o cliente e carrega o kit
informado pela URL. O kit de destino nunca pode substituir o carrinho anterior antes do salvamento.

O rascunho inclui itens, quantidades, preços-base negociados, impostos selecionados, observação e o
vínculo eventual com uma solicitação de aprovação. Ele pertence exclusivamente ao usuário
autenticado. Tokens temporários de cotação e chaves de confirmação não são persistidos. Retomar um
rascunho exige uma nova cotação autoritativa antes da confirmação. Finalizar o cliente atual remove
somente o rascunho desse cliente; os demais pedidos da fila são preservados.

Selecionar ou trocar o cliente invalida a cotação aberta e recarrega o catálogo compatível.
Gerar pedido exige cliente e revalida no backend segmento, classe, listas, versões, faixas e
vínculos dos kits. Uma linha avulsa envia `productCode` e `priceListVersionId`; uma linha de kit
envia `calculationId` e a referência mínima ou máxima.

## Confirmação, registro e envio

**Gerar pedido** apenas solicita uma cotação atual e abre a revisão. Ela mostra cliente, emissor,
destinatários, origens e versões, quantidades, valores de referência em todos os itens, preços
negociados, impostos,
subtotais, total, observação e avisos. Fechar, pressionar `Esc` ou voltar não cria registros.

**Confirmar e enviar pedido** revalida as fontes e exige uma chave idempotente. A mesma tentativa e
o mesmo conteúdo recuperam o pedido existente; reutilizar a chave com outro conteúdo é conflito.
Mudanças no carrinho ou nas fontes invalidam a revisão. A cotação identifica de forma estruturada
preços negociados abaixo do mínimo da lista/faixa selecionada e não emite token utilizável para
confirmar o pedido. Usuários com `price.override` podem criar uma solicitação idempotente com
justificativa, acompanhar somente os próprios registros e cancelar uma solicitação ainda pendente.
A tela destaca as linhas em exceção e, em amarelo, o preço unitário informado, o subtotal
da linha e o total do pedido enquanto houver valor abaixo do mínimo. Também troca a ação principal
para **Solicitar aprovação**, exige
justificativa. O carrinho não apresenta histórico de solicitações, evitando expor a negociação
durante o atendimento ao cliente; o acompanhamento pessoal fica exclusivamente no sino do
cabeçalho. Uma aprovação não libera
o token antigo: o usuário retoma o carrinho aprovado, faz uma nova cotação e só então confirma. Se
cliente, item, quantidade, preço, lista, faixa, versão ou mínimo mudar, a liberação é recusada.

O sino pessoal mostra no máximo as três solicitações mais recentes dos últimos sete dias. Por ele o
solicitante consulta o resultado, cancela uma pendência ou retoma o carrinho fotografado. O limite é
somente de apresentação: solicitações e auditoria não são apagadas.

A confirmação final reserva e consome a aprovação junto com o pedido, itens, primeira entrega de
e-mail e auditoria na mesma transação. A aprovação não pode criar um segundo pedido; o replay da
mesma chave idempotente retorna o pedido original. Reprovação, cancelamento, substituição,
expiração e fontes que deixaram de ser válidas mantêm a confirmação bloqueada.

O commit grava pedido `SUBMITTED`, itens, primeira entrega `PENDING` e auditoria. A tela informa o
número sem afirmar que o e-mail foi entregue. Depois do registro, a revisão fecha e uma notificação
inferior informa que o envio está em processamento. Enquanto a página permanece aberta, a interface
acompanha a entrega por tempo limitado e notifica a aceitação pelo provedor ou a falha definitiva;
uma entrega ainda pendente após esse período continua registrada para processamento assíncrono.
Falha do provedor nunca desfaz o pedido. O criador
pode consultar seu snapshot e os estados de entrega; administradores podem consultar qualquer
pedido. `ACCEPTED` significa somente aceitação pelo provedor, pois o webhook foi adiado.

No corpo HTML e na versão em texto do e-mail, cada item informa separadamente o **Valor de
referência**, o **Preço unitário** negociado e o **Preço com impostos**. O valor de referência
aparece mesmo quando é igual ao negociado. No HTML, **Total de itens** e **Valor Total** ocupam a
última linha da tabela de itens, nas duas colunas mais à direita. O valor monetário usa tipografia
maior e em negrito para se destacar do restante do resumo.

Cada item grava separadamente o preço de referência e o preço unitário negociado. O último valor
vendido é consultado a partir desse snapshot imutável; não é copiado para produto, kit ou cálculo.

## Kits padrões

Um cálculo nasce como `CUSTOMER_SPECIFIC`. Administradores podem alterar sua disponibilidade no
catálogo de Produtos salvos para `STANDARD`, preservando o cálculo e seus vínculos históricos.
