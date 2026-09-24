# Tela de Cálculo de Preço

## Identificação

- Rota: `/calculos/novo`
- Permissão: `calculation.create`
- Finalidade: cálculo exclusivo de kits

## Fluxo

1. O usuário importa a folha de processo Korp.
2. Seleciona um cliente ativo.
3. A classe do cliente identifica automaticamente a única lista `KIT_COMPONENT` ativa e com
   versão ativa. A lista é informativa e não pode ser escolhida manualmente.
4. O backend analisa a composição e calcula os valores mínimo e máximo. O campo histórico
   `normalPrice` continua armazenando o valor agora apresentado como máximo.
5. A prévia mostra a composição somente para conferência nessa tela.
6. Ao salvar, cliente, classe, lista e versão são revalidados e o kit fica vinculado ao cliente.

Usuários com `calculation.export` podem exportar a prévia para um workbook `.xlsx` real. Quando
uma foto local foi selecionada, o arquivo incorpora essa foto mesmo antes do salvamento; sem uma
seleção local, usa a imagem apresentada na prévia. Preços, totais e quantidades permanecem
numéricos no workbook.

Se nenhuma lista atender à classe, ou se mais de uma lista estiver ativa para a mesma classe, o
cálculo fica bloqueado até a correção do cadastro. Componentes da folha não se tornam ofertas
avulsas no Pedido.

## Histórico

Cada versão preserva arquivo, hash, lista, versão da lista, composição, totais e responsável. O
vínculo fotografa cliente e classe. Alterações posteriores não reescrevem cálculos salvos.
