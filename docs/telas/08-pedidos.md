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
referências. Cada oferta avulsa mostra também o IPI e o ICMS definidos na respectiva lista, e o
carrinho destaca as alíquotas da lista selecionada. Os impostos são informativos e não são somados
novamente ao valor da lista.

Produtos avulsos possuem um campo compacto de imposto percentual ao lado do preço. O campo recebe
automaticamente o IPI da lista selecionada e permanece informativo; o subtotal da linha é
`preço unitário × quantidade`, sem reaplicar o imposto ao valor. Kits não recebem esse campo.

Com um cliente selecionado, cada linha do carrinho consulta e mostra o último preço unitário
efetivamente negociado para aquele cliente. A consulta considera somente pedidos `SUBMITTED`: para
produtos avulsos usa o código do produto e, para kits, a versão exata do cálculo. O histórico é
informativo, inclui número e data do pedido e não substitui o preço de referência nem preenche
automaticamente o preço negociado atual.

Cada usuário possui um único espaço persistente para o pedido anterior não finalizado. Ao trocar de
cliente, o carrinho atual é salvo nesse espaço e substitui qualquer pedido anterior que estivesse
guardado. Se o cliente escolhido for justamente o cliente do pedido salvo, a troca é atômica: o
carrinho salvo é restaurado e o carrinho que estava aberto passa a ocupar o mesmo espaço. Um
carrinho vazio não substitui o pedido anterior. A tela mostra cliente, quantidade, total e data do
único pedido salvo, permite retomá-lo ou descartá-lo explicitamente e identifica o cliente no
seletor.

Ao fechar o cliente pelo botão **X**, um carrinho em montagem é salvo nesse mesmo espaço antes de
a tela limpar o cliente e os itens. Se o salvamento falhar, cliente e carrinho permanecem abertos
para evitar perda de dados. Sem itens no carrinho, o **X** apenas remove a seleção do cliente.

A navegação **Gerar pedido** da tela de Clientes segue a mesma regra: primeiro salva ou troca
atomicamente o pedido que já estava em montagem e somente depois seleciona o cliente e carrega o kit
informado pela URL. O kit de destino nunca pode substituir o carrinho anterior antes do salvamento.

O rascunho inclui itens, quantidades, preços negociados, impostos informativos, observação e o
vínculo eventual com uma solicitação de aprovação. Ele pertence exclusivamente ao usuário
autenticado. Tokens temporários de cotação e chaves de confirmação não são persistidos. Retomar um
rascunho exige uma nova cotação autoritativa antes da confirmação. Finalizar o cliente atual remove
o rascunho somente quando ele pertence ao mesmo cliente; um pedido anterior de outro cliente é
preservado.

Selecionar ou trocar o cliente invalida a cotação aberta e recarrega o catálogo compatível.
Gerar pedido exige cliente e revalida no backend segmento, classe, listas, versões, faixas e
vínculos dos kits. Uma linha avulsa envia `productCode` e `priceListVersionId`; uma linha de kit
envia `calculationId` e a referência mínima ou máxima.

## Confirmação, registro e envio

**Gerar pedido** apenas solicita uma cotação atual e abre a revisão. Ela mostra cliente, emissor,
destinatários, origens e versões, quantidades, preços de referência e negociados, impostos,
subtotais, total, observação e avisos. Fechar, pressionar `Esc` ou voltar não cria registros.

**Confirmar e enviar pedido** revalida as fontes e exige uma chave idempotente. A mesma tentativa e
o mesmo conteúdo recuperam o pedido existente; reutilizar a chave com outro conteúdo é conflito.
Mudanças no carrinho ou nas fontes invalidam a revisão. A cotação identifica de forma estruturada
preços negociados abaixo do mínimo da lista/faixa selecionada e não emite token utilizável para
confirmar o pedido. Usuários com `price.override` podem criar uma solicitação idempotente com
justificativa, acompanhar somente os próprios registros e cancelar uma solicitação ainda pendente.
A tela destaca as linhas em exceção, troca a ação principal para **Solicitar aprovação**, exige
justificativa e mostra os registros do usuário em **Minhas solicitações**. Uma aprovação não libera
o token antigo: o usuário retoma o carrinho aprovado, faz uma nova cotação e só então confirma. Se
cliente, item, quantidade, preço, lista, faixa, versão ou mínimo mudar, a liberação é recusada.

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

Cada item grava separadamente o preço de referência e o preço unitário negociado. O último valor
vendido é consultado a partir desse snapshot imutável; não é copiado para produto, kit ou cálculo.

## Kits padrões

Um cálculo nasce como `CUSTOMER_SPECIFIC`. Administradores podem alterar sua disponibilidade no
catálogo de Produtos salvos para `STANDARD`, preservando o cálculo e seus vínculos históricos.
