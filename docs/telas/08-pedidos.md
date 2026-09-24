# Tela de Pedidos

## Identificação

- Rota: `/pedidos/novo`
- Permissões: `order.access`, `price.view` e permissões de cliente conforme a ação
- Estado: montagem e cotação server-side; persistência do pedido fora do escopo

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

Selecionar ou trocar o cliente invalida o carrinho anterior e recarrega o catálogo compatível.
Gerar pedido exige cliente e revalida no backend segmento, classe, listas, versões, faixas e
vínculos dos kits. Uma linha avulsa envia `productCode` e `priceListVersionId`; uma linha de kit
envia `calculationId` e a referência mínima ou máxima.

## Kits padrões

Um cálculo nasce como `CUSTOMER_SPECIFIC`. Administradores podem alterar sua disponibilidade no
catálogo de Produtos salvos para `STANDARD`, preservando o cálculo e seus vínculos históricos.
