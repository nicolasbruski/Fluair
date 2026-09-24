# Tela de Clientes

## Identificação

- Rota: `/clientes`
- Permissões: `customer.view` e `customer.manage`
- Estado: implementada com persistência MySQL e classificações normalizadas

## Dados e migração

A base inicial contém 1.507 clientes preservados do sistema de Comissões. Classe e segmento são
entidades normalizadas com IDs e códigos estáveis; o rótulo textual de segmento permanece apenas
para compatibilidade comercial e comissões. Valores ausentes continuam como “Não classificado”.

Clientes não são carregados de constantes JavaScript ou armazenamento do navegador e nunca são
apagados fisicamente. Código, razão social, vendedor, representante, observações, situação e campos
de comissão existentes são preservados.

## Funcionalidades

- busca por código, razão social, segmento, vendedor ou representante;
- filtros por classe, segmento, vendedor, representante/venda direta e situação;
- paginação;
- criação e edição com classes e segmentos ativos carregados da API;
- ativação e desativação;
- exportação CSV com classificação normalizada;
- estado explícito para cliente não classificado.

## API e segurança

- `GET /api/v1/customers`
- `GET /api/v1/customers/export`
- `GET /api/v1/customers/classifications`
- `POST /api/v1/customers`
- `POST /api/v1/customers/pre-registration`
- `PATCH /api/v1/customers/:id`
- `POST /api/v1/customers/:id/activate`
- `POST /api/v1/customers/:id/deactivate`

Consultas e exportação exigem `customer.view` ou `customer.manage`; mutações exigem
`customer.manage` e geram auditoria. Referências inexistentes, inativas ou incompatíveis são
rejeitadas pelo backend.

O pré-cadastro iniciado em Pedidos é restrito a administradores e exige somente razão social,
classe e segmento. O backend gera um código provisório com prefixo `PRE-`; o cadastro completo pode
ser complementado e ter o código comercial substituído posteriormente nesta tela.

## Integração

Pedidos usa somente clientes ativos e revalida segmento e classe em cada consulta de catálogo ou
cotação. A troca de cliente invalida o carrinho anterior. Cálculos exigem cliente ativo e classe
autorizada no salvamento, fotografando cliente e classe no histórico. Comissões continua usando o
rótulo de segmento, vendedor e representante e aceita o segmento normalizado como fallback.

Como Pedidos ainda não é persistido, não existe fotografia de cliente em entidade de pedido neste
recorte; ela deverá ser definida junto ao modelo definitivo de pedidos.

O nome do cliente na tabela abre “Itens vinculados”. A consulta usa
`GET /api/v1/customers/:id/calculation-links` e mostra cada kit/cálculo associado, versão, lista,
classe fotografada, autor e data do vínculo, além dos itens da composição com quantidades e preços.
