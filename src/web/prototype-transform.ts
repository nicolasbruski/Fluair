const navigation = `<!-- NAV MIGRADA -->
<nav class="nav" id="app-nav" aria-label="Navegação principal" hidden>
  <div class="nav-brand">
    <div class="nav-logo"><img src="/Logo.jpg" alt="Fluair"></div>
  </div>
  <a class="tab" href="/calculos" data-screen="busca" data-permissions="calculation.view">Busca</a>
  <a class="tab" href="/calculos/novo" data-screen="calc" data-permissions="calculation.create">Calcular</a>
  <a class="tab" href="/pedidos/novo" data-screen="pedido" data-permissions="order.access">Pedidos</a>
  <a class="tab" href="/produtos" data-screen="produtos" data-permissions="price.view,catalog.manage">Produtos</a>
  <a class="tab" href="/clientes" data-screen="clientes" data-permissions="customer.view,customer.manage">Clientes</a>
  <a class="tab" href="/listas" data-screen="matriz" data-permissions="matrix.view,matrix.manage">Listas de Preço</a>
  <a class="tab" href="/comissoes" data-screen="comissoes" data-permissions="commission.access">Comissões</a>
  <a class="tab" href="/usuarios" data-screen="usuarios" data-permissions="user.view,user.manage">Usuários</a>
  <div class="session-user" aria-label="Sessão atual">
    <label class="price-visibility-toggle" for="hide-reference-prices" title="Ocultar valores mínimos e normais">
      <span class="price-visibility-label">Ocultar preços</span>
      <input id="hide-reference-prices" data-reference-price-visibility type="checkbox" role="switch" aria-label="Ocultar valores mínimos e normais">
      <span class="price-visibility-track" aria-hidden="true"></span>
    </label>
    <span class="session-user-name" id="session-user-name"></span>
    <button class="btn btn-ghost btn-sm" id="logout-button" type="button">Sair</button>
  </div>
</nav>`;

const ordersScreen = `<!-- PEDIDOS INTEGRADOS À API -->
<div class="screen" id="s-pedido">
  <style>
    .order-kit-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}.order-kit-tag{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:rgba(255,107,0,.1);border:1px solid rgba(255,107,0,.2);color:#a85000;font-size:9px;font-weight:750}.cliente-option-code{width:110px;flex:0 0 110px;overflow:hidden;text-overflow:ellipsis;color:var(--accent);font-family:'DM Mono',monospace;font-size:11px;font-weight:750;text-align:left;white-space:nowrap}
    .order-step{padding:18px 20px;margin-bottom:16px}.order-step-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.order-step-title{font-size:13px;font-weight:800}.order-list-options{display:grid;gap:8px}.order-list-option{width:100%;border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:12px 14px;text-align:left;color:var(--text);cursor:pointer}.order-list-option:hover,.order-list-option.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.order-list-option small{display:block;color:var(--text2);margin-top:4px}.order-state{padding:18px;border:1px dashed var(--border);border-radius:10px;color:var(--text2);font-size:12px;text-align:center}.order-state.error{border-color:#dc2626;color:#b91c1c}.order-kind{display:inline-flex;width:fit-content;justify-self:start;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.order-kind.kit{background:rgba(255,107,0,.12);color:#ff6b00}.order-kind.product{background:rgba(34,197,94,.12);color:#16803b}.cliente-select-arrow{display:flex;width:28px;height:28px;flex:0 0 28px;align-items:center;justify-content:center;line-height:1}.cliente-select-clear{position:absolute;z-index:2;top:50%;right:39px;width:28px;height:28px;padding:0;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:transparent;color:var(--text3);font-family:Arial,sans-serif;font-size:18px;line-height:28px;cursor:pointer}.cliente-select-clear:hover,.cliente-select-clear:focus-visible{background:#fff0ee;color:var(--red);outline:none}.cliente-select-clear[hidden]{display:none}.pedido-client-picker.has-selection .cliente-select-trigger{padding-right:76px}.order-source{font-size:10px;color:var(--text3);margin-top:6px}.order-cart-row .order-source{line-height:1.45;margin-top:7px;margin-bottom:2px}.order-cart-reference-prices{display:block;margin-top:5px;font-weight:650}.order-cart-price-minimum,.order-cart-price-normal,.order-cart-price-range{display:block;color:var(--text2)}.order-cart-price-normal,.order-cart-price-range+.order-cart-price-range{margin-top:2px}.order-cart-price-range strong{color:var(--text2);font-weight:750}.order-card-actions{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}.order-card-actions .btn{flex:1;justify-content:center}.order-pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px}.order-cart-row{padding:12px;border-bottom:1px solid var(--border)}.order-cart-top{display:flex;justify-content:space-between;gap:8px}.order-cart-desc{font-size:12px;font-weight:650;margin-top:4px}.order-cart-controls{display:grid;grid-template-columns:72px minmax(100px,150px);justify-content:start;gap:8px;margin-top:10px}.order-cart-field label{display:block;color:var(--text3);font-size:9px;font-weight:750;text-transform:uppercase;margin-bottom:4px}.order-cart-field .inp{width:100%;padding:7px}.order-cart-subtotal{grid-column:1/-1;text-align:left;font-weight:800}.order-more{padding:12px}.order-more .btn{width:100%;justify-content:center}.order-drawer-filters{display:flex;flex-wrap:wrap;flex-shrink:0;gap:7px;padding:10px 18px 10px}.order-drawer-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 18px 24px;display:grid;align-content:start;gap:10px}.order-drawer-list .item-card{min-height:auto;display:grid;grid-template-columns:132px minmax(0,1fr);column-gap:18px;row-gap:8px;align-items:start}.order-drawer-list .item-card>.media-image{grid-column:1;grid-row:1/span 6;width:132px!important;height:99px!important;align-self:center;justify-self:center}.order-drawer-list .item-card>:not(.media-image){grid-column:2;min-width:0}.order-empty{padding:28px 16px;text-align:center;color:var(--text3);font-size:12px}
    .order-cart-controls{grid-template-columns:72px minmax(120px,160px) minmax(70px,1fr);align-items:end}.order-cart-controls.has-tax{grid-template-columns:72px minmax(120px,160px) 86px minmax(70px,1fr)}.order-cart-tax-field{width:86px}.order-cart-tax-field .inp{text-align:right}
    .order-cart-subtotal{grid-column:auto;text-align:right;padding-bottom:8px;white-space:nowrap}.order-cart-summary{display:flex;align-items:flex-start;gap:10px;margin-top:8px}.order-cart-summary__copy{min-width:0;flex:1}.order-drawer-list .media-image{align-self:flex-start}
    .order-clickable-card{cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}.order-clickable-card:hover,.order-clickable-card:focus-visible{border-color:var(--accent);box-shadow:0 0 0 2px rgba(255,107,0,.12);outline:none;transform:translateY(-1px)}.order-clickable-card.disabled{cursor:not-allowed;opacity:.6}.order-card-prices{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.order-card-price{display:inline-flex;width:fit-content;border:1px solid var(--border);border-radius:8px;background:var(--surface2);padding:7px 9px;font-size:11px;font-weight:750}.order-card-hint{margin-top:9px;color:var(--accent);font-size:10px;font-weight:800}
    .order-kind{align-self:flex-start;align-items:center;justify-content:center;line-height:1}
    .order-drawer-price-toggle{min-height:28px;padding-right:0;border-right:0}#s-pedido .order-drawer-meta{justify-content:space-between;gap:16px}.order-card-prices.ranges{flex-direction:column;align-items:flex-start}.order-card-price-range{display:inline-flex;width:fit-content;box-sizing:border-box;color:var(--text);font-family:inherit;cursor:pointer}.order-card-price-range:hover,.order-card-price-range:focus-visible{border-color:var(--accent);outline:none;box-shadow:0 0 0 2px rgba(255,107,0,.12)}.order-card-price-range:disabled{cursor:not-allowed;opacity:.6}
    .order-pagination[hidden]{display:none}.orders-shell{position:relative;width:min(100%,850px);margin:0 auto}.orders-shell .pedido-panel{position:relative;top:auto}.order-back-row{margin-bottom:12px}.order-back-row #order-back{position:absolute;top:0;left:calc(50% - 44vw)}.order-back-row #order-back[hidden]{display:none}.order-range-warning{margin:14px 18px 0}.order-drawer-source{flex-shrink:0;padding:14px 18px;border-bottom:1px solid var(--border)}.order-drawer-source-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.order-drawer-source-title{font-size:11px;font-weight:800;text-transform:uppercase;color:var(--text2);letter-spacing:.04em}.order-drawer-source .order-list-options{max-height:26vh;overflow-y:auto}.order-drawer-source .order-state{padding:12px}.order-drawer-meta{display:flex;align-items:center;justify-content:flex-end;padding:0 18px 10px}.order-pagination{padding:12px 18px 18px;margin-top:0}.order-cart-row{padding:14px 18px}.order-step-head .btn[hidden]{display:none}.order-customer-pre-dialog{max-width:520px}.order-customer-pre-copy{margin:-4px 0 16px;color:var(--text2);font-size:12px;line-height:1.5}.order-customer-pre-grid{display:grid;gap:12px}.order-customer-pre-grid .fld{margin:0}.order-customer-pre-error{margin-top:14px}#order-drawer{width:660px}@media(max-width:1100px){.order-back-row #order-back{position:static}}@media(max-width:700px){.order-cart-controls,.order-cart-controls.has-tax{grid-template-columns:1fr}.order-cart-subtotal{text-align:left;padding:0}.order-step-head{align-items:flex-start;flex-direction:column}.order-cart-summary .media-image{width:64px!important;height:48px!important}.order-drawer-list .item-card{grid-template-columns:96px minmax(0,1fr);column-gap:12px;padding:14px}.order-drawer-list .item-card>.media-image{width:96px!important;height:72px!important}}
    #s-pedido .order-drawer-source{display:none}
  </style>
  <div class="orders-shell">
    <div class="order-back-row"><button type="button" class="btn btn-ghost" id="order-back" hidden>Voltar</button></div>
      <div class="card order-step"><div class="order-step-head"><div class="order-step-title">1 · Cliente do pedido</div><button type="button" class="btn btn-ghost btn-sm" id="order-customer-add">Pré cadastro de cliente</button></div><div class="pedido-client-picker" id="pedidoClientePicker"><button type="button" class="cliente-select-trigger" id="pedido-client-trigger" aria-expanded="false" aria-controls="pedidoClienteDropdown"><div class="cliente-select-copy"><div class="cliente-select-label placeholder" id="pedidoClienteTriggerLabel">Escolha um cliente para este pedido</div><div class="cliente-select-meta" id="pedidoClienteTriggerMeta">Busque por código, razão social ou segmento</div></div><div class="cliente-select-arrow">▼</div></button><button type="button" class="cliente-select-clear" id="pedido-client-clear" aria-label="Remover cliente selecionado" title="Remover cliente" hidden>×</button><div class="cliente-dropdown" id="pedidoClienteDropdown"><div class="cliente-dropdown-top"><div class="cliente-search-shell"><span class="search-token">Buscar</span><input type="text" class="cliente-search-input" id="pedidoClienteSearch" placeholder="Digite código ou razão social"></div></div><div class="cliente-options" id="pedidoClienteOptions" role="listbox" aria-live="polite"></div></div></div><input type="hidden" id="pedidoCliente"></div>
      <div class="pedido-panel"><div class="pp-header"><div class="panel-token green">PED</div><div class="pp-title">Pedido em montagem</div><div class="cart-badge" id="pedidoCartBadge">0</div></div><div id="order-range-warning" class="order-state order-range-warning" role="alert" hidden></div><div id="pedidoItems"><div class="order-empty">Nenhum item adicionado.</div></div><div class="order-more"><button type="button" class="btn btn-ghost" id="order-drawer-open">Adicionar mais itens</button></div><div class="obs-wrap"><div class="lbl" style="margin-bottom:6px">Observações</div><textarea class="obs-textarea" id="pedidoObs" placeholder="Prazo, condição negociada ou instruções"></textarea></div><div class="pp-footer"><div class="pp-total-row"><span class="pp-total-label">Itens</span><span class="pp-total-val" id="pedidoTotalQty">0 itens</span></div><div class="pp-grand-sep"></div><div class="pp-grand"><span class="pp-grand-label">Total do pedido</span><span class="pp-grand-val" id="pedidoSubNor">R$ 0,00</span></div><div id="order-quote-feedback" class="order-state" role="status" aria-live="polite" hidden></div><button class="email-btn" id="order-review" disabled>Gerar pedido</button><div class="email-sub">Os itens são validados no servidor antes da conclusão da montagem.</div></div></div>
  </div>
  <div class="modal-overlay" id="order-customer-pre-modal"><div class="modal order-customer-pre-dialog" role="dialog" aria-modal="true" aria-labelledby="order-customer-pre-title"><div class="modal-header"><div class="modal-title" id="order-customer-pre-title">Pré-cadastrar cliente</div><button class="modal-close" id="order-customer-pre-close" type="button" aria-label="Fechar">×</button></div><p class="order-customer-pre-copy">Cadastre os dados essenciais agora. As demais informações poderão ser completadas depois na tela de Clientes.</p><form id="order-customer-pre-form" novalidate><div class="order-customer-pre-grid"><div class="fld"><label class="lbl" for="order-customer-legal-name">Razão social</label><input class="inp" id="order-customer-legal-name" maxlength="180" minlength="2" required></div><div class="fld"><label class="lbl" for="order-customer-class">Classe</label><select class="inp" id="order-customer-class" required><option value="">Selecione a classe</option></select></div><div class="fld"><label class="lbl" for="order-customer-segment">Segmento</label><select class="inp" id="order-customer-segment" required><option value="">Selecione o segmento</option></select></div></div><div class="users-form-error order-customer-pre-error" id="order-customer-pre-error" role="alert" hidden></div><div class="modal-footer"><button class="btn btn-ghost" id="order-customer-pre-cancel" type="button">Cancelar</button><button class="btn btn-primary" id="order-customer-pre-submit" type="submit">Salvar e selecionar</button></div></form></div></div>
  <div class="drawer-overlay" id="order-drawer-overlay"></div><aside class="drawer" id="order-drawer" aria-hidden="true" aria-labelledby="order-drawer-title"><div class="drawer-header"><div class="panel-token gray">IT</div><div class="drawer-title" id="order-drawer-title">Adicionar itens ao pedido</div><button type="button" class="drawer-close" id="order-drawer-close" aria-label="Fechar">×</button></div><div class="order-drawer-source"><div class="order-drawer-source-head"><div class="order-drawer-source-title">Lista de preço autorizada</div><button type="button" class="btn btn-ghost btn-sm" id="order-reload-lists" hidden>Atualizar</button></div><div id="order-price-lists" class="order-list-options" aria-live="polite"><div class="order-state">Selecione um cliente para consultar as listas permitidas.</div></div></div><div class="drawer-search"><input type="search" class="inp" id="order-drawer-search" placeholder="Buscar por código, descrição ou referência" aria-label="Buscar itens do pedido"></div><div class="order-drawer-filters" id="order-drawer-filters"><button type="button" class="filter-chip on" data-order-filter="ALL">Todos</button><button type="button" class="filter-chip" data-order-filter="KIT">Kits</button><button type="button" class="filter-chip" data-order-filter="VALVE">Válvulas</button><button type="button" class="filter-chip" data-order-filter="ITEM">Itens</button></div><div class="order-drawer-meta"><label class="price-visibility-toggle order-drawer-price-toggle" for="order-hide-reference-prices" title="Ocultar valores mínimos e máximos"><span class="price-visibility-label">Ocultar preços</span><input id="order-hide-reference-prices" data-reference-price-visibility type="checkbox" role="switch" aria-label="Ocultar preços no catálogo"><span class="price-visibility-track" aria-hidden="true"></span></label><span id="order-catalog-count" class="grid-count"></span></div><div class="order-drawer-list" id="order-drawer-list" aria-live="polite"></div><div class="order-pagination" id="order-pagination" hidden><button type="button" class="btn btn-ghost btn-sm" id="order-page-prev">Anterior</button><span id="order-page-label"></span><button type="button" class="btn btn-ghost btn-sm" id="order-page-next">Próxima</button></div></aside>
</div>`;

const loginScreen = `<!-- ═══════════════════════════════════════════════════
     TELA 1: LOGIN MIGRADO
════════════════════════════════════════════════════ -->
<div class="screen" id="s-login">
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <img class="login-logo" src="/Logo.jpg" alt="Fluair">
        <h1>Sistema de Formação de Preço</h1>
      </div>

      <form id="login-form" novalidate>
        <div class="fld">
          <label class="lbl" for="login-email">E-mail</label>
          <div class="inp-icon">
            <span class="ico" aria-hidden="true">@</span>
            <input class="inp" id="login-email" name="email" type="email" inputmode="email"
              autocomplete="username" maxlength="254" placeholder="nome@empresa.com.br" required
              aria-describedby="login-email-error">
          </div>
          <span class="field-error" id="login-email-error" aria-live="polite"></span>
        </div>
        <div class="fld">
          <label class="lbl" for="login-password">Senha</label>
          <div class="inp-icon">
            <span class="ico" aria-hidden="true">SEG</span>
            <input class="inp login-password-input" id="login-password" name="password" type="password"
              autocomplete="current-password" maxlength="256" required
              aria-describedby="login-password-error">
            <button class="password-toggle" id="login-password-toggle" type="button"
              aria-label="Exibir senha" aria-controls="login-password" aria-pressed="false">
              <svg class="password-eye password-eye-show" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
                <circle cx="12" cy="12" r="2.5"></circle>
              </svg>
              <svg class="password-eye password-eye-hide" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m3 3 18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
              </svg>
            </button>
          </div>
          <span class="field-error" id="login-password-error" aria-live="polite"></span>
        </div>

        <div class="login-error" id="login-error" role="alert" aria-live="assertive" hidden></div>
        <button class="btn btn-primary login-submit" id="login-submit" type="submit">
          <span id="login-submit-label">Entrar</span>
        </button>
      </form>

      <p class="login-help">Problemas para acessar? Fale com o administrador.</p>
    </div>
  </div>
</div>`;

const sharedScreens = `<div class="screen on" id="s-session-loading" aria-live="polite">
  <div class="auth-state"><span class="auth-spinner" aria-hidden="true"></span><p>Verificando sua sessão…</p></div>
</div>
<div class="screen" id="s-forbidden">
  <div class="auth-state">
    <div class="auth-state-mark" aria-hidden="true">Acesso</div>
    <h1>Você não possui acesso a esta área</h1>
    <p>Use uma opção disponível no menu ou fale com o administrador.</p>
  </div>
</div>`;

const searchScreen = `<!-- BUSCA SEM DADOS DEMONSTRATIVOS -->
<div class="screen" id="s-busca">
  <style>
    #busca-table td{vertical-align:middle}.search-photo-cell{width:80px}.search-photo-cell .media-image{display:inline-grid}@media(max-width:700px){.search-photo-cell{width:64px;padding-right:4px}.search-photo-cell .media-image{width:56px!important;height:42px!important}#busca-table th,#busca-table td{padding-left:8px;padding-right:8px}}
  </style>

  <div class="grid-toolbar">
    <div class="grid-search">
      <span class="search-token">Buscar</span>
      <input type="text" id="busca-q" placeholder="Buscar por código, descrição ou referência...">
    </div>
    <select class="inp" style="width:auto;padding:8px 12px;font-size:12px;flex-shrink:0" id="busca-cli">
      <option value="">Todos os perfis de preço</option>
    </select>
    <div class="grid-count" id="busca-count"></div>
  </div>

  <div class="card" style="padding:0;overflow:hidden;margin-bottom:8px">
    <div style="overflow-x:auto">
      <table id="busca-table">
        <thead>
          <tr>
            <th>Foto</th>
            <th class="sortable" id="bsh-code">Código</th>
            <th class="sortable" id="bsh-desc">Descrição</th>
            <th class="sortable" id="bsh-reference">Referência</th>
            <th class="sortable" id="bsh-client">Perfil de preço</th>
            <th class="sortable reference-price" id="bsh-tabMin" style="text-align:right;color:#ff6b00">Tab. Mínima</th>
            <th class="sortable reference-price" id="bsh-tabNor" style="text-align:right;color:var(--accent)">Tab. Máxima</th>
            <th class="sortable" id="bsh-date">Calculado em</th>
            <th>Por</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="busca-tbody"></tbody>
      </table>
    </div>
  </div>
  <div class="pg" id="busca-pg"></div>
</div>`;

const productsScreen = `<!-- CATÁLOGO SALVO -->
<div class="screen" id="s-produtos">
  <style>
    .products-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.products-head h1{font-size:24px;letter-spacing:-.4px;margin-bottom:5px}.products-head p{font-size:13px;color:var(--text2);line-height:1.5}.products-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}.products-toolbar .grid-search{flex:1;min-width:240px}.products-filter{min-width:175px}#products-table td{vertical-align:middle}.products-action{white-space:nowrap;text-align:right}.products-action .btn+.btn{margin-left:6px}.products-code{font-family:'SF Mono',monospace;color:var(--accent);font-size:12px}.products-description{min-width:220px}.products-reference{color:var(--text2);max-width:250px}.products-feedback{padding:11px 14px;border-radius:8px;background:#e9fbe9;color:#1d7a1d;font-size:12px;margin-bottom:12px}.products-feedback.is-error,.products-photo-state.is-error{background:#fff0ee;color:var(--red)}.products-empty{padding:42px 20px}.products-photo-cell{width:88px}.media-image{box-sizing:border-box;padding:0;border-radius:8px;border:1px solid var(--border);color:inherit;font:inherit}.media-image__content{display:block}.media-image__placeholder{padding:5px;text-align:center;font-size:9px;line-height:1.25;color:var(--text3)}.media-image--expandable{cursor:zoom-in}.media-image--expandable:hover,.media-image--expandable:focus-visible{border-color:var(--accent);outline:none;box-shadow:0 0 0 2px rgba(0,122,255,.18)}.media-image-viewer__dialog{width:min(900px,calc(100vw - 32px));max-width:900px}.media-image-viewer__content{display:grid;place-items:center;min-height:220px;padding:18px}.media-image-viewer__content img{display:block;max-width:100%;max-height:calc(100vh - 150px);object-fit:contain}.media-image-viewer__error{color:var(--text2)}.products-photo-preview{display:grid;place-items:center;min-height:180px;border:1px dashed var(--border);border-radius:10px;background:var(--surface2);margin-bottom:14px}.products-photo-preview-image{display:block;width:220px;height:160px;object-fit:contain;border-radius:8px}.products-photo-state{padding:8px 10px;border-radius:7px;background:var(--surface2);color:var(--text2);font-size:11px;margin-top:10px}.products-photo-help{font-size:11px;color:var(--text2);margin-top:7px}.products-composition-modal{display:flex;flex-direction:column;width:min(1080px,calc(100vw - 32px));max-width:1080px;max-height:calc(100vh - 40px)}.products-composition-meta{padding:14px 20px;border-bottom:1px solid var(--border);background:var(--surface2)}.products-composition-label{color:var(--text3);font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.products-composition-customers{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}.products-customer{display:inline-flex;gap:6px;align-items:center;padding:6px 9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:11px}.products-composition-body{min-height:180px;overflow:auto}.products-composition-state{padding:48px 20px;text-align:center;color:var(--text2)}.products-composition-table{font-size:11px}.products-composition-table thead th{position:sticky;top:0;z-index:1;background:var(--surface2)}.products-composition-table .number{text-align:right;white-space:nowrap}@media(max-width:700px){.products-head{display:block}.products-filter{width:100%}.products-reference{max-width:none}.products-photo-cell .media-image{width:56px!important;height:44px!important}.media-image-viewer__content{padding:10px}}
    .products-type{width:1%;white-space:nowrap}.products-type .order-kind{white-space:nowrap}.products-customer-link{color:inherit;text-decoration:none;cursor:pointer;transition:border-color .15s,box-shadow .15s}.products-customer-link:hover,.products-customer-link:focus-visible{border-color:var(--accent);box-shadow:0 0 0 2px rgba(255,107,0,.12);outline:none}.products-customer-link .products-customer-code{text-decoration:underline;text-underline-offset:2px}
  </style>
  <div class="products-head"><div><h1>Catálogo de produtos</h1><p>Consulte kits e produtos avulsos e gerencie a foto exibida no catálogo.</p></div><span class="tag tag-blue" id="products-manage-badge" hidden>Fotos habilitadas</span></div>
  <div id="products-feedback" class="products-feedback" role="status" aria-live="polite" hidden></div>
  <div class="products-toolbar">
    <div class="grid-search"><span class="search-token">Buscar</span><input id="products-search" type="search" placeholder="Código, descrição ou referência..."></div>
    <select class="inp products-filter" id="products-filter" aria-label="Filtrar catálogo"><option value="ALL">Todos</option><option value="KITS">Kits</option><option value="PRODUCTS">Produtos avulsos</option><option value="WITHOUT_IMAGE">Sem foto</option></select>
    <div class="grid-count" id="products-count"></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:8px"><div style="overflow-x:auto"><table id="products-table"><thead><tr><th>Foto</th><th>Tipo</th><th>Código</th><th>Descrição</th><th>Referência</th><th>Origem</th><th>Ações</th></tr></thead><tbody id="products-tbody"></tbody></table></div></div>
  <div class="pg" id="products-pagination"></div>
</div>

<div class="modal-overlay" id="products-photo-modal" role="dialog" aria-modal="true" aria-labelledby="products-photo-title"><div class="modal"><div class="modal-header"><div class="modal-title" id="products-photo-title">Foto do catálogo</div><button class="modal-close" type="button" data-products-photo-close aria-label="Fechar">×</button></div><form id="products-photo-form"><div class="products-photo-preview" id="products-photo-preview"></div><div class="fld"><label class="lbl" for="products-photo-file">Selecionar nova imagem</label><input class="inp" id="products-photo-file" type="file" accept="image/jpeg,image/png,image/webp"><p class="products-photo-help">JPEG, PNG ou WebP, até 5 MB. A imagem será ajustada automaticamente.</p></div><div class="products-photo-state" id="products-photo-state" role="status" aria-live="polite" hidden></div><div class="modal-footer"><button class="btn btn-danger" id="products-photo-remove" type="button">Remover foto</button><button class="btn btn-ghost" type="button" data-products-photo-close>Cancelar</button><button class="btn btn-primary" id="products-photo-save" type="submit" disabled>Confirmar foto</button></div></form></div></div>

<div class="modal-overlay" id="products-composition-modal" role="dialog" aria-modal="true" aria-labelledby="products-composition-title"><div class="modal products-composition-modal"><div class="modal-header"><div><div class="modal-title" id="products-composition-title">Composição do kit</div><div class="customer-details-subtitle" id="products-composition-subtitle"></div></div><button class="modal-close" type="button" data-products-composition-close aria-label="Fechar">×</button></div><div class="products-composition-meta"><div class="products-composition-label">Cliente vinculado</div><div class="products-composition-customers" id="products-composition-customers"></div></div><div class="products-composition-body" id="products-composition-body"></div><div class="modal-footer"><button class="btn btn-ghost" type="button" data-products-composition-close>Fechar</button></div></div></div>`;

const detailScreen = `<!-- DETALHE DE CÁLCULO INTEGRADO À API -->
<div class="screen" id="s-detalhe">
  <style>.detail-version-photo{display:flex;flex-direction:column;align-items:center;gap:5px;flex:0 0 180px}.detail-version-photo__label{color:var(--text3);font-size:9px;font-weight:750;text-transform:uppercase}@media(max-width:700px){.detail-version-photo{flex-basis:100%;align-items:flex-start}.detail-version-photo .media-image{width:100%!important;height:180px!important}}</style>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <button class="btn btn-ghost" id="detail-back" type="button" style="gap:6px">Voltar para Busca</button>
    <div style="flex:1"></div>
    <button class="btn btn-ghost" id="detail-order" type="button" style="gap:7px">Gerar pedido com este kit</button>
    <button class="btn btn-ghost" id="detail-history" type="button" style="gap:7px">Histórico de versões</button>
    <span class="tag tag-blue" style="font-size:12px;padding:5px 12px">Dados do banco</span>
  </div>
  <div id="detail-feedback" class="order-state error" role="alert" hidden></div>
  <div id="detalhe-main" aria-live="polite">
    <div class="calc-empty"><div class="calc-empty-ico">Kit</div><div class="calc-empty-title">Carregando cálculo…</div></div>
  </div>
</div>`;

const historyModal = `<!-- HISTÓRICO REAL DE VERSÕES DO KIT -->
<div class="modal-overlay" id="modal-historico" role="dialog" aria-modal="true" aria-labelledby="hist-modal-title">
  <div class="modal" style="max-width:680px">
    <div class="modal-header">
      <div><div class="modal-title" id="hist-modal-title">Histórico de versões</div><div style="font-size:12px;color:var(--text2);margin-top:2px" id="hist-modal-sub"></div></div>
      <button class="modal-close" id="detail-history-close" type="button" aria-label="Fechar">✕</button>
    </div>
    <div id="hist-modal-body" aria-live="polite"></div>
    <div class="modal-footer"><button class="btn btn-ghost" id="detail-history-done" type="button">Fechar</button></div>
  </div>
</div>

`;

const historyScreen = `<!-- HISTÓRICO ACESSADO PELO DETALHE REAL -->
<div class="screen" id="s-historico">
  <div class="calc-empty"><div class="calc-empty-ico">Hist</div><div class="calc-empty-title">Abra um cálculo para consultar seu histórico</div><div class="calc-empty-desc">A linha do tempo real fica disponível no botão Histórico de versões da tela de Detalhe.</div></div>
</div>`;

const calculationScreen = `<!-- CÁLCULO INTEGRADO À API -->
<div class="screen" id="s-calc">
  <div class="calc-page-toolbar">
    <button class="calc-gear-button" id="calc-matrices-open" type="button" style="margin-left:auto"
      aria-label="Consultar listas de componentes" aria-haspopup="dialog"
      aria-controls="calc-matrices-modal">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3h4v.08a1.7 1.7 0 0 0 1.06 1.52 1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>
      </svg>
      <span class="calc-gear-status" id="calc-gear-status" aria-hidden="true"></span>
    </button>
  </div>

  <div class="cols cols-side calc-workspace">
    <aside class="calc-sidebar">
      <div class="card card-sm">
        <div class="stitle" style="margin-top:0">1 · Folha de processo</div>
        <label class="upCard" id="calc-korp-zone" for="calc-korp-input">
          <input id="calc-korp-input" type="file" accept=".xls,.xlsx">
          <div class="calc-upload-token">XLS</div>
          <div class="calc-upload-title">Folha de Processo</div>
          <div class="calc-upload-help">.xls ou .xlsx exportado do Korp</div>
          <div class="upFile" id="calc-korp-file"></div>
        </label>

        <div class="stitle">2 · Foto opcional</div>
        <div class="calc-photo-picker" id="calc-photo-picker">
          <input id="calc-photo-input" type="file" accept="image/jpeg,image/png,image/webp">
          <div class="calc-photo-preview" id="calc-photo-preview" aria-live="polite">
            <div class="calc-photo-placeholder">Sem foto selecionada</div>
          </div>
          <div class="calc-photo-actions">
            <label class="btn btn-ghost btn-sm" for="calc-photo-input" id="calc-photo-choose">Escolher foto</label>
            <button class="btn btn-ghost btn-sm" id="calc-photo-remove" type="button" hidden>Remover seleção</button>
          </div>
          <div class="calc-photo-status" id="calc-photo-status">JPEG, PNG ou WebP, até 5 MB.</div>
        </div>

        <div class="stitle">3 · Cliente</div>
        <div class="calc-customer-picker" id="calc-customer-panel">
          <button class="cliente-select-trigger" id="calc-customer-trigger" type="button" aria-haspopup="dialog" aria-controls="calc-customer-modal">
            <div class="cliente-select-copy">
              <div class="cliente-select-label placeholder" id="calc-selected-customer">Escolha um cliente</div>
              <div class="cliente-select-meta" id="calc-selected-customer-meta">Busque por código ou razão social</div>
            </div>
            <div class="cliente-select-arrow" aria-hidden="true">›</div>
          </button>
          <input id="calc-customer-id" type="hidden">
          </div>

        <div class="stitle">4 · Lista identificada</div>
        <div class="calc-profile-buttons" id="calc-price-list-options" role="status"></div>
        <div class="calc-active-matrix" id="calc-active-matrix">Carregando matriz ativa…</div>

        <button class="pBtn" id="calc-run" type="button" disabled>Calcular preço</button>
      </div>
    </aside>

    <main id="calc-main">
      <div class="calc-empty">
        <div class="calc-empty-ico">Base</div>
        <div class="calc-empty-title">Pronto para calcular</div>
        <div class="calc-empty-desc">Importe a folha Korp e selecione o cliente. A lista de componentes será identificada automaticamente pela classe.</div>
      </div>
    </main>
  </div>

  <div class="modal-overlay" id="calc-customer-modal" role="dialog" aria-modal="true" aria-labelledby="calc-customer-modal-title">
    <div class="modal calc-customer-dialog">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="calc-customer-modal-title">Selecionar cliente</div>
          <div class="calc-save-subtitle">Busque um cliente ativo para este cálculo.</div>
        </div>
        <button class="modal-close" id="calc-customer-close" type="button" aria-label="Fechar">✕</button>
      </div>
      <div class="grid-search calc-customer-search"><span class="search-token">Buscar</span><input id="calc-customer-search" placeholder="Código, razão social ou segmento" autocomplete="off"></div>
      <div class="calc-customer-list"><div class="calc-customer-options" id="calc-customer-options" role="listbox" aria-live="polite"></div></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="calc-customer-cancel" type="button">Fechar</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="calc-matrices-modal" role="dialog" aria-modal="true" aria-labelledby="calc-matrices-title">
    <div class="modal calc-matrices-dialog">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="calc-matrices-title">Listas de componentes</div>
          <div class="calc-save-subtitle">Consulte classes e versões disponíveis para os próximos cálculos.</div>
        </div>
        <button class="modal-close" id="calc-matrices-close" type="button" aria-label="Fechar">✕</button>
      </div>
      <div class="calc-feedback" id="calc-matrices-feedback" hidden></div>
      <div class="calc-matrix-cards" id="calc-matrix-cards" aria-live="polite"></div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="calc-matrices-done" type="button">Concluir</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="calc-save-modal" role="dialog" aria-modal="true" aria-labelledby="calc-save-title">
    <div class="modal calc-save-dialog">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="calc-save-title">Salvar cálculo</div>
          <div class="calc-save-subtitle" id="calc-save-subtitle"></div>
        </div>
        <button class="modal-close" id="calc-save-close" type="button" aria-label="Fechar">✕</button>
      </div>
      <div class="calc-existing-state" id="calc-existing-state"></div>
      <label class="calc-choice" id="calc-recalculate-choice">
        <input id="calc-recalculate" type="checkbox">
        <span><strong>Recalcular e criar uma nova versão</strong><small>A versão atual continuará disponível no histórico.</small></span>
      </label>
      <div class="calc-existing-state">O cliente selecionado e a lista identificada serão validados novamente antes do salvamento.</div>
      <div class="calc-save-error" id="calc-save-error" hidden></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="calc-save-cancel" type="button">Cancelar</button>
        <button class="btn btn-primary" id="calc-save-confirm" type="button">Confirmar salvamento</button>
      </div>
    </div>
  </div>
</div>`;

const usersScreen = `<!-- USUÁRIOS INTEGRADOS À API -->
<div class="screen" id="s-usuarios">

  <div class="cols cols-2 users-layout" style="align-items:start">
    <section aria-labelledby="users-list-title">
      <div class="stitle" id="users-list-title" style="margin-top:0">Usuários cadastrados</div>
      <div class="users-feedback" id="users-feedback" role="status" aria-live="polite" hidden></div>
      <div id="lista-usuarios" aria-live="polite">
        <div class="users-state">Carregando usuários…</div>
      </div>
    </section>

    <div>
      <section id="users-create-section" aria-labelledby="users-create-title">
        <div class="stitle" id="users-create-title" style="margin-top:0">Criar novo usuário</div>
        <form class="card" id="users-create-form" novalidate>
          <div class="fld">
            <label class="lbl" for="novo-nome">Nome</label>
            <input class="inp" id="novo-nome" name="name" maxlength="120" autocomplete="off" required>
          </div>
          <div class="fld">
            <label class="lbl" for="novo-email">E-mail</label>
            <input class="inp" id="novo-email" name="email" maxlength="254" type="email" autocomplete="off" required>
          </div>
          <div class="fld">
            <label class="lbl" for="novo-senha">Senha inicial</label>
            <div class="inp-icon">
              <span class="ico" aria-hidden="true">SEG</span>
              <input class="inp login-password-input" id="novo-senha" name="password" type="password" minlength="8" maxlength="256" autocomplete="new-password" required>
              <button class="password-toggle" id="novo-senha-toggle" type="button"
                aria-label="Exibir senha inicial" aria-controls="novo-senha" aria-pressed="false">
                <svg class="password-eye password-eye-show" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
                  <circle cx="12" cy="12" r="2.5"></circle>
                </svg>
                <svg class="password-eye password-eye-hide" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="fld">
            <label class="lbl" for="novo-perfil">Perfil</label>
            <select class="inp" id="novo-perfil" name="roleCode" required></select>
          </div>
          <div class="fld">
            <label class="users-access-toggle" for="novo-comissoes">
              <input id="novo-comissoes" name="commissionAccess" type="checkbox">
              <span><strong>Acesso a Comissões</strong><small>Libera o sistema de fechamento mensal para este usuário.</small></span>
            </label>
          </div>
          <div class="users-form-error" id="novo-erro" role="alert" hidden></div>
          <button class="btn btn-primary" id="users-create-submit" style="width:100%;justify-content:center" type="submit">Criar usuário</button>
        </form>
      </section>

      <div class="stitle">Permissões por perfil</div>
      <div class="card card-sm" style="padding:0;overflow:hidden">
        <table>
          <thead><tr><th>Perfil</th><th>Permissões</th></tr></thead>
          <tbody id="users-roles-body"><tr><td colspan="2">Carregando…</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;

const customersScreen = `<!-- CLIENTES INTEGRADOS À API -->
<div class="screen" id="s-clientes">

  <div class="customers-heading">
    <div>
      <h1>Banco de Clientes</h1>
      <p>Consulte e gerencie os clientes usados nas comissões e nos pedidos.</p>
    </div>
    <div class="customers-heading-actions">
      <button class="btn btn-ghost btn-sm" id="customers-export" type="button">Exportar base</button>
      <button class="btn btn-primary btn-sm" id="customers-add" type="button">+ Adicionar cliente</button>
    </div>
  </div>

  <div class="customers-feedback" id="customers-feedback" role="status" aria-live="polite" hidden></div>
  <section class="card customers-card" aria-label="Lista de clientes">
    <div class="customers-toolbar">
      <div class="grid-search customers-search">
        <span class="search-token">Buscar</span>
        <input id="customers-search" type="search" maxlength="180" placeholder="Código, razão social, segmento, vendedor…">
      </div>
      <select class="inp" id="customers-class" aria-label="Filtrar por classe"><option value="">Todas as classes</option></select>
      <select class="inp" id="customers-segment" aria-label="Filtrar por segmento"><option value="">Todos os segmentos</option></select>
      <select class="inp" id="customers-seller" aria-label="Filtrar por vendedor"><option value="">Todos os vendedores</option></select>
      <select class="inp" id="customers-representative" aria-label="Filtrar por representante"><option value="">Todos os representantes</option></select>
      <select class="inp" id="customers-status" aria-label="Filtrar por situação">
        <option value="active">Clientes ativos</option>
        <option value="inactive">Clientes desativados</option>
        <option value="all">Todos os clientes</option>
      </select>
      <button class="btn btn-ghost btn-sm" id="customers-clear" type="button">Limpar</button>
    </div>
    <div class="customers-table-wrap">
      <table class="customers-table">
        <thead><tr><th>Código</th><th>Razão social</th><th>CNPJ</th><th>Cidade</th><th>UF</th><th class="customer-classification">Classe</th><th class="customer-classification">Segmento</th><th>Vendedor</th><th>Representante</th><th>Atualizado</th><th>Ações</th></tr></thead>
        <tbody id="customers-body"><tr><td class="customers-loading" colspan="11">Carregando clientes…</td></tr></tbody>
      </table>
    </div>
    <div class="customers-pagination">
      <button class="btn btn-ghost btn-sm" id="customers-prev" type="button">Anterior</button>
      <span id="customers-page-label">Página 1 de 1</span>
      <button class="btn btn-ghost btn-sm" id="customers-next" type="button">Próxima</button>
    </div>
  </section>
</div>`;

const priceListsScreen = `<!-- LISTAS DE PREÇO INTEGRADAS À API -->
<div class="screen" id="s-matriz">
  <div class="price-lists-heading">
    <div><h1>Listas de Preço</h1><p>Configure o público, a faixa e as versões usadas nos cálculos e pedidos.</p></div>
    <div class="price-lists-heading-actions">
      <button class="btn btn-ghost btn-sm" id="price-lists-refresh" type="button">Atualizar</button>
      <button class="btn btn-primary btn-sm" id="price-lists-add" type="button">+ Nova lista</button>
    </div>
  </div>
  <div class="customers-feedback" id="price-lists-feedback" role="status" aria-live="polite" hidden></div>
  <div id="price-lists-content" aria-live="polite"><div class="price-list-state">Carregando listas de preço…</div></div>
</div>`;

const usersModals = `<!-- MODAIS DE USUÁRIOS INTEGRADOS À API -->
<div class="modal-overlay" id="modal-editar-usuario">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
    <div class="modal-header">
      <div class="modal-title" id="edit-user-title">Editar usuário</div>
      <button class="modal-close" id="edit-user-close" type="button" aria-label="Fechar">×</button>
    </div>
    <form id="users-edit-form" novalidate>
      <div class="fld">
        <label class="lbl" for="edit-nome">Nome</label>
        <input class="inp" id="edit-nome" name="name" maxlength="120" required>
      </div>
      <div class="fld">
        <label class="lbl" for="edit-email">E-mail</label>
        <input class="inp" id="edit-email" name="email" type="email" maxlength="254" required>
      </div>
      <div class="fld">
        <label class="lbl" for="edit-senha">Nova senha <span class="users-optional">(deixe vazio para manter)</span></label>
        <div class="inp-icon">
          <span class="ico" aria-hidden="true">SEG</span>
          <input class="inp login-password-input" id="edit-senha" name="password" type="password" minlength="8" maxlength="256" autocomplete="new-password">
          <button class="password-toggle" id="edit-senha-toggle" type="button"
            aria-label="Exibir nova senha" aria-controls="edit-senha" aria-pressed="false">
            <svg class="password-eye password-eye-show" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
              <circle cx="12" cy="12" r="2.5"></circle>
            </svg>
            <svg class="password-eye password-eye-hide" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 3 18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="fld">
        <label class="lbl" for="edit-perfil">Perfil</label>
        <select class="inp" id="edit-perfil" name="roleCode" required></select>
      </div>
      <div class="fld">
        <label class="users-access-toggle" for="edit-comissoes">
          <input id="edit-comissoes" name="commissionAccess" type="checkbox">
          <span><strong>Acesso a Comissões</strong><small>Libera o sistema de fechamento mensal para este usuário.</small></span>
        </label>
      </div>
      <div class="users-form-error" id="edit-user-error" role="alert" hidden></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="edit-user-cancel" type="button">Cancelar</button>
        <button class="btn btn-primary" id="edit-user-submit" type="submit">Salvar alterações</button>
      </div>
    </form>
  </div>
</div>

<div class="modal-overlay" id="modal-status-usuario">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="status-user-title">
    <div class="modal-header">
      <div class="modal-title" id="status-user-title">Alterar acesso</div>
      <button class="modal-close" id="status-user-close" type="button" aria-label="Fechar">×</button>
    </div>
    <p class="users-status-message" id="status-user-message"></p>
    <div class="users-form-error" id="status-user-error" role="alert" hidden></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="status-user-cancel" type="button">Cancelar</button>
      <button class="btn btn-danger" id="status-user-confirm" type="button">Desativar usuário</button>
    </div>
  </div>
</div>`;

const customersModals = `<!-- MODAIS DE CLIENTES INTEGRADOS À API -->
<div class="modal-overlay" id="customer-form-modal">
  <div class="modal customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
    <div class="modal-header">
      <div class="modal-title" id="customer-form-title">Adicionar cliente</div>
      <button class="modal-close" id="customer-form-close" type="button" aria-label="Fechar">×</button>
    </div>
    <form id="customer-form" novalidate>
      <div class="customer-form-grid">
        <div class="fld">
          <label class="lbl" for="customer-code">Código</label>
          <input class="inp customer-code-input" id="customer-code" maxlength="20" required placeholder="C00000">
        </div>
        <div class="fld customer-name-field">
          <label class="lbl" for="customer-legal-name">Razão social</label>
          <input class="inp" id="customer-legal-name" maxlength="180" required placeholder="Nome da empresa">
        </div>
        <div class="fld">
          <label class="lbl" for="customer-cnpj">CNPJ</label>
          <input class="inp" id="customer-cnpj" maxlength="18" inputmode="numeric" autocomplete="off" placeholder="00.000.000/0000-00">
        </div>
        <div class="fld customer-location-field">
          <div><label class="lbl" for="customer-city">Cidade</label><input class="inp" id="customer-city" maxlength="120" placeholder="Cidade"></div>
          <div><label class="lbl" for="customer-state">Estado</label><input class="inp customer-state-input" id="customer-state" minlength="2" maxlength="2" pattern="[A-Za-z]{2}" title="Informe a UF com 2 letras" placeholder="UF"></div>
        </div>
        <div class="fld">
          <label class="lbl" for="customer-class">Classe</label>
          <select class="inp" id="customer-class"><option value="">Não classificado</option></select>
          <small class="customer-note-help">Define as listas disponíveis para cálculo de kits.</small>
        </div>
        <div class="fld">
          <label class="lbl" for="customer-segment">Segmento</label>
          <select class="inp" id="customer-segment"><option value="">Não classificado</option></select>
          <small class="customer-note-help">Define as listas de produtos disponíveis no pedido.</small>
        </div>
        <div class="fld">
          <label class="lbl" for="customer-seller">Vendedor</label>
          <input class="inp" id="customer-seller" maxlength="120" placeholder="Nome do vendedor">
        </div>
        <div class="fld">
          <label class="lbl" for="customer-representative">Representante</label>
          <input class="inp" id="customer-representative" maxlength="120" placeholder="Vazio para venda direta">
        </div>
        <div class="fld customer-note-field">
          <label class="lbl" for="customer-internal-note">Observação do perfil</label>
          <textarea class="inp customer-note-input" id="customer-internal-note" maxlength="2000" rows="3" placeholder="Informação interna, visível somente no cadastro do cliente"></textarea>
          <small class="customer-note-help">Esta observação não será incluída nos pedidos.</small>
        </div>
        <div class="fld customer-note-field">
          <label class="lbl" for="customer-order-note">Observação padrão do pedido</label>
          <textarea class="inp customer-note-input" id="customer-order-note" maxlength="2000" rows="3" placeholder="Texto copiado ao selecionar este cliente em um novo pedido"></textarea>
          <small class="customer-note-help">A cópia poderá ser editada no pedido sem alterar o cadastro.</small>
        </div>
      </div>
      <div class="users-form-error" id="customer-form-error" role="alert" hidden></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="customer-form-cancel" type="button">Cancelar</button>
        <button class="btn btn-primary" id="customer-form-submit" type="submit">Adicionar cliente</button>
      </div>
    </form>
  </div>
</div>

<div class="modal-overlay" id="customer-status-modal">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="customer-status-title">
    <div class="modal-header">
      <div class="modal-title" id="customer-status-title">Desativar cliente</div>
      <button class="modal-close" id="customer-status-close" type="button" aria-label="Fechar">×</button>
    </div>
    <p class="users-status-message" id="customer-status-message"></p>
    <div class="users-form-error" id="customer-status-error" role="alert" hidden></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="customer-status-cancel" type="button">Cancelar</button>
      <button class="btn btn-danger" id="customer-status-confirm" type="button">Desativar cliente</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="customer-links-modal">
  <div class="modal customer-links-modal" role="dialog" aria-modal="true" aria-labelledby="customer-links-title">
    <div class="modal-header">
      <div><div class="modal-title" id="customer-links-title">Detalhes do cliente</div><div class="customer-details-subtitle" id="customer-details-subtitle"></div></div>
      <button class="modal-close" id="customer-links-close" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="customer-details-tabs" role="tablist" aria-label="Detalhes do cliente">
      <button class="customer-details-tab is-active" id="customer-info-tab" type="button" role="tab" aria-selected="true" aria-controls="customer-info-panel">Informações</button>
      <button class="customer-details-tab" id="customer-kits-tab" type="button" role="tab" aria-selected="false" aria-controls="customer-kits-panel">Kits vinculados</button>
    </div>
    <div class="customer-details-panel" id="customer-info-panel" role="tabpanel" aria-labelledby="customer-info-tab"></div>
    <div class="customer-details-panel" id="customer-kits-panel" role="tabpanel" aria-labelledby="customer-kits-tab" hidden>
      <div class="customer-links-body" id="customer-links-body" aria-live="polite"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-primary" id="customer-links-done" type="button">Concluir</button></div>
  </div>
</div>
<style>
  .customer-name-content{display:flex;align-items:center;justify-content:space-between;gap:14px;min-width:210px}.customer-status-badge{display:inline-flex;align-items:center;gap:4px;margin-left:auto;padding:3px 6px;border:1px solid rgba(22,128,59,.16);border-radius:999px;box-shadow:0 1px 2px rgba(0,0,0,.04);white-space:nowrap}.customer-status-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}.customer-status-badge.tag-red{border-color:rgba(190,24,93,.16)}
  .customer-name-link{appearance:none;border:0;background:none;padding:0;color:inherit;text-align:left;cursor:pointer}.customer-name-link:hover,.customer-name-link:focus-visible{color:var(--accent);text-decoration:underline}.customer-links-modal{display:flex;flex-direction:column;max-width:920px;height:min(650px,calc(100vh - 40px));max-height:calc(100vh - 40px)}.customer-links-modal>.modal-header,.customer-links-modal>.customer-details-tabs,.customer-links-modal>.modal-footer{flex:0 0 auto}.customer-details-subtitle{margin-top:3px;color:var(--text3);font-size:10px}.customer-details-tabs{display:flex;gap:4px;padding:0 20px;border-bottom:1px solid var(--border)}.customer-details-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:none;padding:10px 13px;color:var(--text2);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.customer-details-tab:hover{color:var(--accent)}.customer-details-tab.is-active{border-bottom-color:var(--accent);color:var(--accent)}.customer-details-panel{flex:1 1 auto;min-height:0;overflow:hidden}.customer-details-panel[hidden]{display:none}.customer-info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;height:100%;padding:18px 20px;overflow:auto}.customer-info-item{min-width:0;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface2)}.customer-info-item dt{margin:0 0 5px;color:var(--text3);font-size:9px;font-weight:800;letter-spacing:.055em;text-transform:uppercase}.customer-info-item dd{margin:0;color:var(--text);font-size:12px;line-height:1.45;overflow-wrap:anywhere}.customer-info-item.is-wide{grid-column:1/-1}.customer-info-item.is-empty dd{color:var(--text3)}.customer-links-body{display:grid;align-content:start;gap:10px;height:100%;overflow:auto;padding:18px 20px}.customer-calculation-card{border:1px solid var(--border);border-radius:12px;overflow:hidden}.customer-calculation-summary{display:block;padding:13px 14px;cursor:pointer;list-style:none}.customer-calculation-summary::-webkit-details-marker{display:none}.customer-calculation-summary:hover{background:var(--surface2)}.customer-calculation-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.customer-calculation-controls{display:flex;align-items:center;gap:8px;flex-shrink:0}.customer-calculation-count{color:var(--text3);font-size:11px;font-weight:700}.customer-calculation-arrow{font-size:22px;line-height:1;transition:transform .16s ease}.customer-calculation-card[open] .customer-calculation-arrow{transform:rotate(90deg)}.customer-calculation-meta{margin-top:5px;color:var(--text3);font-size:11px}.customer-calculation-content{max-height:clamp(140px,calc(100vh - 330px),320px);overflow:auto;scrollbar-gutter:stable;border-top:1px solid var(--border);padding:0px 0px 12px}.customer-calculation-content::-webkit-scrollbar{width:8px;height:8px}.customer-calculation-content::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:999px;background:var(--border);background-clip:padding-box}.customer-calculation-items{font-size:11px}.customer-calculation-items thead th{position:sticky;top:0;z-index:1;background:var(--surface2)}.customer-calculation-items th,.customer-calculation-items td{padding:8px 9px}@media(max-width:700px){.customer-info-grid{grid-template-columns:repeat(2,minmax(0,1fr));padding:14px}.customer-details-tabs{padding:0 14px}}@media(max-width:460px){.customer-info-grid{grid-template-columns:1fr}.customer-info-item.is-wide{grid-column:auto}}
</style>`;

const priceListsModals = `<!-- MODAL DE LISTA DE PREÇO -->
<div class="modal-overlay" id="price-list-form-modal">
  <div class="modal price-list-modal" role="dialog" aria-modal="true" aria-labelledby="price-list-form-title">
    <div class="modal-header"><div class="modal-title" id="price-list-form-title">Nova lista de preço</div><button class="modal-close" id="price-list-form-close" type="button" aria-label="Fechar">×</button></div>
    <form id="price-list-form" novalidate>
      <div class="price-list-form-grid">
        <div class="fld"><label class="lbl" for="price-list-code">Código</label><input class="inp price-list-code-input" id="price-list-code" maxlength="60" required></div>
        <div class="fld"><label class="lbl" for="price-list-type">Tipo</label><select class="inp" id="price-list-type"><option value="KIT_COMPONENT">Kit com estrutura</option><option value="STANDALONE_PRODUCT">Produto sem estrutura</option></select></div>
        <div class="fld price-list-name-field"><label class="lbl" for="price-list-name">Nome</label><input class="inp" id="price-list-name" maxlength="120" required></div>
        <div class="fld"><label class="lbl" for="price-list-minimum">Quantidade mínima <span class="users-optional">(opcional)</span></label><input class="inp" id="price-list-minimum" type="number" min="0" step="1"></div>
        <div class="fld"><label class="lbl" for="price-list-maximum">Quantidade máxima <span class="users-optional">(opcional)</span></label><input class="inp" id="price-list-maximum" type="number" min="0" step="1"></div>
      </div>
      <fieldset class="price-list-audience"><legend class="lbl" id="price-list-audience-label">Classes de clientes</legend><div class="price-list-audience-options" id="price-list-audience-options"></div></fieldset>
      <div class="users-form-error" id="price-list-form-error" role="alert" hidden></div>
      <div class="modal-footer"><button class="btn btn-ghost" id="price-list-form-cancel" type="button">Cancelar</button><button class="btn btn-primary" id="price-list-form-submit" type="submit">Criar lista</button></div>
    </form>
  </div>
</div>
<div class="modal-overlay" id="price-list-structure-modal">
  <div class="modal price-list-structure-modal" role="dialog" aria-modal="true" aria-labelledby="price-list-structure-title">
    <div class="modal-header"><div><div class="modal-title" id="price-list-structure-title">Estrutura carregada</div><div class="price-list-structure-subtitle" id="price-list-structure-subtitle"></div></div><button class="modal-close" id="price-list-structure-close" type="button" aria-label="Fechar">×</button></div>
    <form class="price-list-structure-toolbar" id="price-list-structure-search-form"><input class="inp" id="price-list-structure-search" type="search" maxlength="120" placeholder="Buscar por código, descrição ou referência"><button class="btn btn-ghost btn-sm" type="submit">Buscar</button></form>
    <div class="price-list-structure-content" id="price-list-structure-content" aria-live="polite"></div>
    <div class="price-list-structure-pagination" id="price-list-structure-pagination" hidden><button class="btn btn-ghost btn-sm" id="price-list-structure-prev" type="button">Anterior</button><span id="price-list-structure-page"></span><button class="btn btn-ghost btn-sm" id="price-list-structure-next" type="button">Próxima</button></div>
  </div>
</div>`;

const migratedStyles = `<style id="migrated-auth-styles">
#s-clientes{position:relative;left:50%;width:min(1320px,calc(100vw - 40px));transform:translateX(-50%)}
.nav{height:58px}.nav[hidden]{display:none!important}.nav a.tab{text-decoration:none}.nav-brand{display:flex;align-items:center;gap:10px;flex-shrink:0;margin-right:16px}.nav-logo{width:65px;height:65px;border-radius:9px;display:flex;align-items:center;justify-content:center;overflow:hidden}.nav-logo img{width:100%;height:100%;object-fit:contain;display:block}.session-user{margin-left:auto;min-height:34px;display:flex;align-items:center;gap:14px;font-size:12px;color:var(--text2);white-space:nowrap}.session-user-name{display:flex;align-items:center;min-height:34px}.price-visibility-toggle{min-height:34px;display:flex;align-items:center;gap:9px;padding-right:16px;border-right:1px solid var(--border);color:var(--text2);font-size:11px;font-weight:650;line-height:1;white-space:nowrap;cursor:pointer}.price-visibility-toggle input{position:absolute;opacity:0;pointer-events:none}.price-visibility-track{position:relative;flex:0 0 auto;width:34px;height:19px;border-radius:999px;background:var(--border);box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);transition:background .15s}.price-visibility-track::after{content:'';position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}.price-visibility-toggle input:checked+.price-visibility-track{background:var(--accent)}.price-visibility-toggle input:checked+.price-visibility-track::after{transform:translateX(15px)}.price-visibility-toggle input:focus-visible+.price-visibility-track{outline:2px solid var(--accent);outline-offset:2px}.reference-prices-hidden .reference-price{display:none!important}
.login-page{min-height:calc(100vh - 48px);display:flex;align-items:center;justify-content:center;padding:24px;}
.login-card{width:100%;max-width:400px;padding:36px 32px;background:var(--surface);border-radius:16px;border:1px solid var(--border);box-shadow:var(--shm)}
.login-brand{text-align:center;margin-bottom:28px}.login-logo{width:120px;height:auto;max-height:68px;object-fit:contain;display:block;margin:0 auto 12px}.login-brand h1{font-size:13px;font-weight:400;color:var(--text2);margin-top:4px}
.login-password-input{padding-right:44px!important}.password-toggle{position:absolute;right:4px;top:50%;width:36px;height:36px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:7px;background:transparent;color:var(--text3);cursor:pointer}.password-eye{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.password-eye-hide,.password-toggle[aria-pressed="true"] .password-eye-show{display:none}.password-toggle[aria-pressed="true"] .password-eye-hide{display:block}
.login-submit{width:100%;justify-content:center;margin-top:8px;min-height:40px}.login-submit:disabled{cursor:wait;opacity:.72}.login-help{text-align:center;margin-top:14px;font-size:12px;color:var(--text3)}
.field-error{min-height:14px;font-size:11px;color:var(--red)}.login-error{background:#fff0ee;border:1px solid #ffd0cc;color:#9f211a;border-radius:8px;padding:10px 12px;margin:2px 0 12px;font-size:12px;line-height:1.45}.login-error[hidden]{display:none}
.inp[aria-invalid="true"]{border-color:var(--red)}.auth-state{min-height:calc(100vh - 100px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;color:var(--text2)}
.auth-state h1{font-size:20px;color:var(--text)}.auth-state p{font-size:13px;max-width:420px}.auth-state-mark{padding:8px 12px;border-radius:10px;background:var(--accent-light);color:var(--accent);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.auth-spinner{width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:_sp .7s linear infinite}
.users-state{padding:36px 20px;text-align:center;color:var(--text2);background:var(--surface);border:1px solid var(--border);border-radius:var(--r)}
.users-feedback,.users-form-error{padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:12px;line-height:1.4}.users-feedback{background:#e9fbe9;color:#1d7a1d;border:1px solid #bde9bd}.users-form-error{background:#fff0ee;color:#9f211a;border:1px solid #ffd0cc}.users-feedback[hidden],.users-form-error[hidden]{display:none}
.user-row.inactive{opacity:.7}.user-row.inactive .avatar{filter:grayscale(1)}.users-user-copy{flex:1;min-width:120px}.users-user-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px}.users-permissions{font-size:10px;color:var(--text3);line-height:1.35}.users-optional{font-weight:400;color:var(--text3)}.users-status-message{font-size:14px;color:var(--text2);line-height:1.6;padding:8px 0}.user-actions{flex-wrap:wrap}
.users-access-toggle{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg)}.users-access-toggle input{margin-top:2px;accent-color:var(--accent)}.users-access-toggle span{display:flex;flex-direction:column;gap:2px}.users-access-toggle strong{font-size:12px}.users-access-toggle small{font-size:10px;color:var(--text3);line-height:1.35}
.customers-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}.customers-heading h1{font-size:22px;margin:0 0 4px}.customers-heading p{font-size:13px;color:var(--text2)}.customers-heading-actions{display:flex;gap:8px;flex-wrap:wrap}.customers-heading-actions .btn[hidden]{display:none}.customers-feedback{padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:12px;background:#e9fbe9;color:#1d7a1d;border:1px solid #bde9bd}.customers-feedback.is-error{background:#fff0ee;color:#9f211a;border-color:#ffd0cc}.customers-feedback[hidden]{display:none}.customers-card{padding:0;overflow:hidden}.customers-toolbar{display:grid;grid-template-columns:minmax(250px,1.65fr) repeat(5,minmax(125px,1fr)) auto;gap:10px;align-items:center;padding:16px;border-bottom:1px solid var(--border);background:var(--surface)}.customers-toolbar .inp{width:100%;min-width:0;height:40px;margin:0;padding:8px 10px;font-size:12px}.customers-toolbar .btn{height:40px;padding-inline:16px}.customers-search{width:100%;min-width:0}.customers-table-wrap{overflow-x:auto}.customers-table{width:100%;table-layout:auto;font-size:10px}.customers-table thead{background:var(--surface2)}.customers-table th,.customers-table td{padding-inline:14px;overflow-wrap:anywhere;vertical-align:middle}.customers-table th{padding-block:9px;color:var(--text2);font-size:9px;line-height:1.2;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap}.customers-table td{padding-block:8px;line-height:1.25}.customers-table th:first-child,.customers-table td:first-child{padding-left:18px}.customers-table th:last-child,.customers-table td:last-child{padding-right:18px}.customer-code{font-family:'DM Mono',monospace;font-size:10px;color:var(--accent);font-weight:700}.customer-name{font-weight:650;max-width:100%;margin-bottom:0;text-align:left;overflow-wrap:anywhere}.customer-tax-id,.customer-city,.customer-state,.customer-updated{white-space:nowrap}.customer-tax-id,.customer-city,.customer-state{font-family:inherit;font-size:inherit;font-weight:400;color:var(--text)}.customer-state{text-align:center}.customer-empty-cell{text-align:center}.customer-empty-value{display:inline-flex;align-items:center;justify-content:center;width:22px;height:18px;border-radius:5px;background:var(--surface2);color:var(--text3);font-family:Arial,sans-serif;font-size:11px;font-weight:500;line-height:1}.customer-updated{text-align:center;font-size:10px;color:var(--text2)}.customer-actions{text-align:center}.customer-actions-buttons{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:3px;width:100%}.customer-actions-buttons .btn{width:100%;min-width:68px;min-height:22px;flex:0 0 auto;padding:0 6px;font-size:9px;line-height:1;white-space:nowrap}.customer-actions-buttons .btn+.btn{margin-left:0}.customer-inactive{opacity:.62}.customers-loading,.customers-empty{text-align:center!important;padding:44px 20px!important;color:var(--text2)}.customers-retry{margin-top:12px}.customers-pagination{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:12px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--text2)}.customer-modal{max-width:680px}.customer-form-grid{display:grid;grid-template-columns:180px 1fr;gap:0 14px}.customer-name-field{grid-column:2}.customer-location-field{display:grid;grid-template-columns:minmax(0,1fr) 70px;gap:10px}.customer-code-input,.customer-state-input{text-transform:uppercase}.customer-note-field{grid-column:1/-1}.customer-note-input{resize:vertical;min-height:76px;font-family:inherit;line-height:1.45}.customer-note-help{display:block;margin-top:5px;color:var(--text3);font-size:10px;line-height:1.4}
.customer-modal{display:flex;flex-direction:column;width:min(600px,calc(100vw - 24px));max-width:600px;max-height:calc(100vh - 24px);padding:20px 22px 18px;overflow:hidden}.customer-modal>.modal-header{flex:0 0 auto;margin-bottom:14px}.customer-modal form{display:flex;min-height:0;flex:1 1 auto;flex-direction:column}.customer-modal .customer-form-grid{grid-template-columns:150px minmax(0,1fr);gap:0 12px;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:4px}.customer-modal .fld{gap:4px;margin-bottom:10px}.customer-modal .lbl{font-size:11px}.customer-modal .inp{padding:8px 11px;font-size:12px}.customer-modal .customer-note-input{min-height:56px}.customer-modal .customer-note-help{margin-top:3px;font-size:9px}.customer-modal .users-form-error,.customer-modal .modal-footer{flex:0 0 auto}.customer-modal .modal-footer{margin-top:12px}.customer-modal .modal-footer .btn{padding:8px 14px;font-size:12px}
.price-lists-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}.price-lists-heading h1{font-size:22px;margin:0 0 4px}.price-lists-heading p,.price-list-section-head p{font-size:12px;color:var(--text2);margin:0}.price-lists-heading-actions{display:flex;gap:8px}.price-list-section{margin-bottom:24px}.price-list-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.price-list-section-head h2{font-size:16px;margin:0 0 3px}.price-list-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.price-list-card{padding:16px;display:flex;flex-direction:column;gap:12px}.price-list-card.is-inactive{opacity:.72}.price-list-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.price-list-card h3{font-size:15px;margin:2px 0 0}.price-list-code{font-family:'DM Mono',monospace;font-size:10px;color:var(--accent);font-weight:700}.price-list-details{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}.price-list-details div{min-width:0}.price-list-details dt{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);font-weight:700}.price-list-details dd{font-size:11px;color:var(--text2);line-height:1.45;margin:2px 0 0}.price-list-no-version{color:var(--orange);font-weight:600}.price-list-actions{display:flex;gap:6px;flex-wrap:wrap}.price-list-import{border-top:1px solid var(--border);padding-top:12px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.price-list-file-label input{display:none}.price-list-file-name{font-size:10px;color:var(--text2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.price-list-preview,.price-list-inline-error{flex-basis:100%;padding:10px;border-radius:8px;font-size:11px}.price-list-preview{background:#f3fbf5;border:1px solid #bde9bd}.price-list-preview.is-invalid,.price-list-inline-error{background:#fff0ee;border:1px solid #ffd0cc;color:#9f211a}.price-list-preview-head{display:flex;justify-content:space-between;gap:10px}.price-list-preview-hash{font-family:'DM Mono',monospace;font-size:9px;overflow-wrap:anywhere;color:var(--text3);margin-top:4px}.price-list-diagnostics{margin-top:8px}.price-list-diagnostics ul{margin:4px 0 0;padding-left:18px;line-height:1.45}.price-list-diagnostics.warnings{color:#805600}.price-list-preview-note{margin:9px 0;color:var(--text2)}.price-list-empty,.price-list-state{grid-column:1/-1;padding:34px 20px;text-align:center;color:var(--text2);background:var(--surface);border:1px dashed var(--border);border-radius:var(--r)}.price-list-warning{padding:10px 12px;margin-bottom:16px;border-radius:8px;background:#fff8e8;border:1px solid #f1d99d;color:#72500b;font-size:12px}.price-list-modal{max-width:720px}.price-list-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.price-list-name-field{grid-column:1/-1}.price-list-code-input{text-transform:uppercase}.price-list-audience{border:0;margin:2px 0 14px;padding:0}.price-list-audience-options{display:grid;grid-template-columns:1fr 1fr;gap:7px}.price-list-audience-option{display:flex;gap:8px;padding:9px;border:1px solid var(--border);border-radius:7px;background:var(--bg);cursor:pointer}.price-list-audience-option input{accent-color:var(--accent)}.price-list-audience-option span{display:flex;flex-direction:column}.price-list-audience-option strong{font-size:11px}.price-list-audience-option small,.price-list-audience-empty{font-size:9px;color:var(--text3)}.price-list-structure-modal{width:min(1100px,calc(100vw - 28px));max-width:1100px}.price-list-structure-subtitle{font-size:10px;color:var(--text3);margin-top:3px}.price-list-structure-toolbar{display:flex;gap:8px;padding:14px 18px;border-bottom:1px solid var(--border)}.price-list-structure-toolbar .inp{flex:1;margin:0}.price-list-structure-content{min-height:180px;max-height:60vh;overflow:auto}.price-list-structure-table{min-width:820px;font-size:11px}.price-list-structure-table th,.price-list-structure-table td{padding:9px 10px}.price-list-structure-table td:first-child{color:var(--text3);text-align:right}.price-list-structure-code{font-family:'DM Mono',monospace;color:var(--accent);font-weight:700}.price-list-structure-number{text-align:center;white-space:nowrap}.price-list-structure-table th:nth-last-child(-n+2){text-align:center}.price-list-structure-pagination{display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid var(--border);font-size:11px;color:var(--text2)}.price-list-structure-pagination[hidden]{display:none}.price-list-structure-state{padding:48px 20px;text-align:center;color:var(--text2)}
.customers-table th:nth-child(10),.customers-table th:nth-child(11){text-align:center}.customer-classification{text-align:center}.customer-classification .tag{display:inline-flex;max-width:100%;white-space:normal;line-height:1.2}
@media(min-width:1101px){.customers-table th:not(:nth-child(2)):not(:nth-child(3)),.customers-table td:not(:nth-child(2)):not(:nth-child(3)){text-align:center}.customers-table th:nth-child(2),.customers-table td:nth-child(2),.customers-table th:nth-child(3),.customers-table td:nth-child(3){text-align:left}.customers-table th:nth-child(2),.customers-table td:nth-child(2){min-width:240px}.customers-table th:nth-child(3),.customers-table td:nth-child(3){min-width:135px}.customers-table th:nth-child(4),.customers-table td:nth-child(4){min-width:120px}.customers-table th:nth-child(5),.customers-table td:nth-child(5){min-width:42px}.customers-table th:nth-child(6),.customers-table td:nth-child(6){min-width:120px}.customers-table td:nth-child(8),.customers-table td:nth-child(9){font-size:9px}.customers-table th:nth-child(11),.customers-table td:nth-child(11){min-width:92px}.customers-table .customer-name-content{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px}.customers-table .customer-status-badge{margin-left:0}}
.customer-actions-buttons .btn{box-sizing:border-box;justify-content:center}
@media(max-width:1100px){.customers-toolbar{grid-template-columns:repeat(3,minmax(0,1fr))}.customers-search{grid-column:1/-1}.customers-table thead{display:none}.customers-table,.customers-table tbody{display:block}.customers-table .customer-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-bottom:1px solid var(--border);padding:8px 12px}.customers-table .customer-row td{display:block;border:0;padding:6px 8px;min-width:0}.customers-table .customer-row td:first-child,.customers-table .customer-row td:last-child{padding-left:8px;padding-right:8px}.customers-table .customer-row td::before{content:attr(data-label);display:block;margin-bottom:3px;font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text3)}.customers-table .customer-row .customer-name-cell{grid-column:span 2}.customers-table .customer-row .customer-actions{grid-column:1/-1;text-align:right}.customers-table .customer-row .customer-actions-buttons{align-items:flex-end;justify-content:flex-end}.customers-table .customer-row .customer-actions-buttons .btn{width:100%;max-width:100px;min-width:80px;flex:0 0 auto}.customer-classification{text-align:left}.customer-state,.customer-updated,.customer-empty-cell{text-align:left}.customers-loading,.customers-empty{display:block;width:100%;box-sizing:border-box}}
@media(max-width:900px){.price-list-grid{grid-template-columns:1fr}}
@media(max-width:620px){.price-lists-heading{flex-direction:column}.price-list-details,.price-list-form-grid,.price-list-audience-options{grid-template-columns:1fr}.price-list-name-field{grid-column:auto}.customers-toolbar{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px}.customers-search{grid-column:1/-1}.customers-table .customer-row{grid-template-columns:repeat(2,minmax(0,1fr))}.customers-table .customer-row .customer-name-cell{grid-column:span 2}}
@media(max-width:900px){.customers-heading{flex-direction:column}.customer-modal .customer-form-grid{grid-template-columns:1fr}.customer-name-field{grid-column:auto}}
@media(max-width:760px){.nav{overflow-x:auto}.session-user{position:sticky;right:0;background:rgba(255,255,255,.96);padding-left:10px;gap:10px}.session-user-name,.price-visibility-label{display:none}.price-visibility-toggle{padding-right:11px}.login-page{padding:16px}.login-card{padding:28px 22px}.customers-heading-actions{width:100%}.customers-heading-actions .btn{flex:1}.customers-pagination{justify-content:center}}
.calc-matrices-section{margin-bottom:24px}.calc-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.calc-section-heading h1{font-size:20px;margin:0 0 4px}.calc-section-heading p{font-size:12px;color:var(--text2);margin:0}.calc-matrix-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.calc-matrix-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px;display:flex;flex-direction:column;gap:10px}.calc-matrix-card.is-active{border-color:#9ddcb3;box-shadow:0 0 0 1px #d9f3e2 inset}.calc-matrix-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.calc-matrix-name{font-size:13px;font-weight:700}.calc-matrix-meta{font-size:11px;color:var(--text2);line-height:1.55;min-height:34px}.calc-matrix-actions{display:flex;align-items:center;gap:8px;margin-top:auto}.calc-matrix-actions input{display:none}.calc-feedback,.calc-save-error{padding:10px 12px;border:1px solid #bde9bd;background:#e9fbe9;color:#1d7a1d;border-radius:8px;font-size:12px;margin-bottom:12px}.calc-feedback.is-error,.calc-save-error{border-color:#ffd0cc;background:#fff0ee;color:#9f211a}.calc-workspace{align-items:start}.calc-sidebar{position:sticky;top:64px;align-self:start}.calc-upload-token{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;color:var(--accent)}.calc-upload-title{font-size:12px;font-weight:600;color:var(--text)}.calc-upload-help{font-size:11px;color:var(--text2);margin-top:2px}.calc-active-matrix{margin-top:8px;padding:9px 10px;border-radius:7px;background:var(--bg);color:var(--text2);font-size:11px;line-height:1.45}.calc-active-matrix.missing{background:#fff5e8;color:#a45200}.calc-preview-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:8px;background:#fff8e8;border:1px solid #f1d99d;margin-bottom:14px;font-size:12px;color:#72500b}.calc-preview-actions{display:flex;gap:7px;flex-wrap:wrap}.calc-save-dialog{max-width:760px}.calc-save-subtitle{font-size:12px;color:var(--text2);margin-top:3px}.calc-existing-state{padding:12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);font-size:12px;line-height:1.55;margin-bottom:12px}.calc-choice{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);margin-bottom:9px;cursor:pointer}.calc-choice input{margin-top:2px;accent-color:var(--accent)}.calc-choice span{display:flex;flex-direction:column;gap:2px}.calc-choice strong{font-size:12px}.calc-choice small{font-size:10px;color:var(--text2)}.calc-customer-panel{padding:14px;border:1px solid var(--border);border-radius:10px;margin-top:10px}.calc-customer-search{margin-top:5px}.calc-customer-list{margin-top:10px;border:1px solid var(--border);border-radius:9px;overflow:hidden;background:var(--surface)}.calc-customer-list-head,.calc-customer-option{display:grid;grid-template-columns:78px minmax(180px,1fr) 125px 110px 24px;gap:10px;align-items:center}.calc-customer-list-head{padding:8px 11px;background:var(--surface2);border-bottom:1px solid var(--border);color:var(--text3);font-size:9px;font-weight:750;text-transform:uppercase;letter-spacing:.05em}.calc-customer-options{max-height:250px;overflow:auto}.calc-customer-option{width:100%;padding:10px 11px;border:0;border-bottom:1px solid var(--border);background:var(--surface);color:var(--text);font-family:inherit;text-align:left;cursor:pointer;transition:background .14s,box-shadow .14s}.calc-customer-option:last-of-type{border-bottom:0}.calc-customer-option:hover,.calc-customer-option:focus-visible{background:var(--accent-light);outline:none}.calc-customer-option.is-selected{background:#f0fdf4;box-shadow:inset 3px 0 0 var(--green)}.calc-customer-code{font-family:'DM Mono',monospace;color:var(--accent);font-size:10px;font-weight:750}.calc-customer-name{min-width:0}.calc-customer-name strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.calc-customer-name small,.calc-customer-owner{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2);font-size:10px}.calc-customer-class{width:fit-content;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 7px;border:1px solid var(--border);border-radius:999px;background:#fff;color:var(--text2);font-size:9px;font-weight:750;text-transform:uppercase}.calc-customer-state{color:var(--text3);font-size:15px;font-weight:800;text-align:center}.calc-customer-option.is-selected .calc-customer-state{color:var(--green)}.calc-selected-customer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;margin-top:9px;border:1px solid #bde9bd;border-radius:8px;background:#f0fdf4;color:#166534;font-size:11px}.calc-selected-customer strong{font-size:11px}.calc-selected-customer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.calc-selected-customer small{flex-shrink:0;color:#3f7b50}.calc-customer-options .cliente-empty{margin:10px}.calc-save-error{margin-top:10px;margin-bottom:0}.calc-result-saved{background:#e9fbe9!important;border-color:#a8f0b8!important;color:#1d7a1d!important}.calc-table-wrap{overflow:auto;max-height:440px}.calc-table-code{font-family:'DM Mono',monospace;color:var(--accent);font-weight:700}.calc-table-number{text-align:right;white-space:nowrap}.calc-no-price{opacity:.56}
.calc-selected-customer[hidden]{display:none}
.calc-photo-picker{padding:11px;border:1px solid var(--border);border-radius:10px;background:var(--bg)}.calc-photo-picker>input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.calc-photo-preview{display:grid;place-items:center;min-height:112px;border:1px dashed var(--border);border-radius:8px;background:var(--surface);overflow:hidden}.calc-photo-preview img{display:block;width:100%;height:132px;object-fit:contain}.calc-photo-placeholder{padding:12px;color:var(--text3);font-size:11px;text-align:center}.calc-photo-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.calc-photo-actions .btn{flex:1;justify-content:center;cursor:pointer}.calc-photo-status{margin-top:7px;color:var(--text2);font-size:10px;line-height:1.4}.calc-photo-status.is-replacement{color:#a45200;font-weight:650}.calc-kit-image{width:112px;min-width:112px}.calc-kit-image img{display:block;width:112px;height:84px;object-fit:contain;border:1px solid var(--border);border-radius:8px;background:var(--surface2)}.calc-kit-image-label{margin-top:4px;color:var(--text3);font-size:9px;text-align:center}@media(max-width:560px){.calc-kit-image{width:100%;min-width:0}.calc-kit-image img{width:100%;height:150px}}
.calc-save-dialog{max-height:calc(100vh - 24px);overflow-y:auto;overscroll-behavior:contain}.calc-save-dialog .calc-customer-options{max-height:125px}.calc-save-dialog .calc-customer-option{padding-top:7px;padding-bottom:7px}.calc-save-dialog .modal-footer{margin-top:12px}
@media(max-width:720px){.calc-customer-list-head{display:none}.calc-customer-option{grid-template-columns:68px minmax(150px,1fr) 24px}.calc-customer-class,.calc-customer-owner{display:none}.calc-save-dialog{max-width:calc(100vw - 20px)}}
@media(max-width:980px){.calc-matrix-cards{grid-template-columns:1fr}.calc-sidebar{position:static}.calc-workspace{grid-template-columns:1fr}}
.calc-page-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.calc-page-toolbar .ann{margin:0}.calc-gear-button{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text2);cursor:pointer;box-shadow:var(--shs);transition:all .15s}.calc-gear-button:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-light)}.calc-gear-button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}.calc-gear-status{position:absolute;right:4px;top:4px;width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 2px #fff}.calc-gear-status.has-missing{background:var(--orange)}.calc-workspace{margin-top:0}.calc-profile-buttons{display:flex;flex-direction:column;gap:6px}.calc-matrices-dialog{max-width:760px}.calc-matrices-dialog .calc-matrix-cards{grid-template-columns:1fr;max-height:460px;overflow:auto;padding:1px}.calc-matrices-dialog .calc-matrix-card{padding:14px 16px}.calc-matrices-dialog .calc-matrix-meta{min-height:0}.calc-matrices-dialog .modal-footer{margin-top:16px}.calc-sidebar .card{box-shadow:var(--shs)}.calc-sidebar .upCard{display:block}
@media(max-width:700px){.calc-page-toolbar{align-items:flex-start}.calc-gear-button{flex-shrink:0}.calc-matrices-dialog{max-width:calc(100vw - 24px)}}
.calc-page-toolbar{margin-bottom:18px}.calc-workspace{grid-template-columns:320px minmax(0,1fr);margin-top:0}.calc-sidebar{position:sticky;top:64px;align-self:start}.calc-sidebar .card{box-shadow:var(--shs)}.calc-sidebar .upCard{display:flex;min-height:132px;flex-direction:column;align-items:center;justify-content:center}.calc-customer-picker{position:relative}.calc-customer-picker .cliente-select-trigger{padding:12px 13px;border-radius:10px;box-shadow:none}.calc-customer-picker .cliente-select-label{font-size:12px}.calc-customer-picker .cliente-select-meta{font-size:10px}.calc-customer-picker .cliente-select-arrow{font-size:22px;transition:transform .15s}.calc-customer-picker .cliente-select-trigger:hover .cliente-select-arrow{transform:translateX(2px)}.calc-customer-dialog{width:min(760px,calc(100vw - 24px));max-width:760px}.calc-customer-dialog .calc-customer-search{margin-top:0}.calc-customer-dialog .calc-customer-options{max-height:min(430px,55vh)}.calc-customer-dialog .modal-footer{margin-top:14px}.calc-customer-dialog .calc-customer-option{grid-template-columns:78px minmax(180px,1fr) 125px 110px 24px}.calc-sidebar .calc-active-matrix{text-align:left}.calc-sidebar .pBtn{width:100%;margin-top:14px}#calc-main{min-width:0}
@media(max-width:980px){.calc-workspace{grid-template-columns:280px minmax(0,1fr)}.calc-customer-dialog .calc-customer-option{grid-template-columns:68px minmax(150px,1fr) 100px 24px}.calc-customer-dialog .calc-customer-owner{display:none}}
@media(max-width:760px){.calc-workspace{grid-template-columns:1fr}.calc-sidebar{position:static}.calc-sidebar .upCard{min-height:120px}}
.calc-photo-preview img{box-sizing:border-box;padding:8px;object-position:center}
.calc-kit-image img{box-sizing:border-box;padding:6px;object-position:center}
.products-photo-preview-image{box-sizing:border-box;padding:8px;object-position:center}
.media-image-viewer__content img{object-position:center}
.media-image{background:#fff}
</style>`;

function replaceSection(
  source: string,
  startMarker: string,
  endMarker: string,
  content: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Não foi possível localizar a seção do protótipo: ${startMarker}`);
  }
  return `${source.slice(0, start)}${content}\n\n${source.slice(end)}`;
}

function removeSearchDemoData(source: string): string {
  let result = source.replace(
    /const _buscaAllData=\(\(\)=>\{[\s\S]*?(?=\/\/ ═+\n\/\/ MODAL MATRIZ)/,
    `function pgRange(cur,total){
  if(total<=7)return Array.from({length:total},(_,i)=>i+1);
  const pages=[1];
  if(cur>3)pages.push('...');
  for(let i=Math.max(2,cur-1);i<=Math.min(total-1,cur+1);i++)pages.push(i);
  if(cur<total-2)pages.push('...');
  pages.push(total);
  return pages;
}

`,
  );
  if (result === source) {
    throw new Error('Não foi possível remover os dados demonstrativos da Busca.');
  }

  result = result.replace(/function verDetalheByCode\(code\)\{[\s\S]*?\n\}\n\n/, '');
  result = result.replace(
    /\/\/ Inicializa busca se já estiver na aba\n[\s\S]*?(?=<\/script>)/,
    '// Inicializa busca se já estiver na aba\n',
  );
  return result.replace("  if(id==='busca') setTimeout(buscaInit,0);\n", '');
}

function removeLegacyDetailBehavior(source: string): string {
  const result = source.replace(
    /function verDetalhe\(idx\)\{[\s\S]*?(?=\/\/ ═+\n\/\/ PEDIDOS)/,
    '',
  );
  if (result === source || result.includes('function generateMockComposition(')) {
    throw new Error('Não foi possível remover o detalhe demonstrativo.');
  }
  return result;
}

function removeLegacyUsersBehavior(source: string): string {
  let result = source.replace(/\/\/ --- Estado dos modais ---[\s\S]*?(?=function closeModal)/, '');
  result = result.replace(/\/\/ --- Criar Usu[^\n]*[\s\S]*?(?=\/\/ ═+\n\/\/ DETALHE DO KIT)/, '');
  if (
    result.includes('function criarUsuario()') ||
    result.includes('function salvarEdicao()') ||
    result.includes('function confirmarExclusao()')
  ) {
    throw new Error('Não foi possível remover o comportamento demonstrativo de Usuários.');
  }
  return result;
}

function migrateOrders(source: string): string {
  let result = replaceSection(
    source,
    '<div class="screen" id="s-pedido">',
    '<div class="screen" id="s-calc">',
    `${ordersScreen}\n\n`,
  );
  result = result.replace(
    /const PEDIDO_PRODUTOS = \[[\s\S]*?(?=\/\/ Inicializa busca se)/,
    `function iniciarPedidoDoKit(){ show('pedido'); }\n\n`,
  );
  result = result.replace("  if(document.getElementById('s-pedido')) pedidoInit();\n", '');
  result = result.replace("  if(id==='pedido') setTimeout(pedidoInit,0);\n", '');
  if (
    result.includes('const PEDIDO_PRODUTOS') ||
    result.includes('const PEDIDO_CLIENTES') ||
    !result.includes('id="order-drawer-list"')
  ) {
    throw new Error('Não foi possível migrar a tela de Pedidos para as fontes reais.');
  }
  return result;
}

export function transformPrototype(source: string): string {
  let result = source
    .replace(/\r\n/g, '\n')
    .replace('Fluair — Esboço Fase 2', 'Fluair — Sistema de Formação de Preço');
  result = result.replace(/<!-- NAV -->[\s\S]*?<\/nav>/, navigation);
  result = replaceSection(
    result,
    '<!-- ═══════════════════════════════════════════════════\n     TELA 1: LOGIN',
    '<!-- ═══════════════════════════════════════════════════\n     TELA 2: BUSCA',
    loginScreen,
  );
  result = replaceSection(
    result,
    '<!-- ═══════════════════════════════════════════════════\n     TELA 2: BUSCA',
    '<!-- ═══════════════════════════════════════════════════\n     TELA DETALHE: KIT',
    searchScreen,
  );
  result = replaceSection(
    result,
    '<div class="screen" id="s-detalhe">',
    '<div class="screen" id="s-pedido">',
    `${detailScreen}\n\n`,
  );
  result = replaceSection(
    result,
    '<div class="screen" id="s-calc">',
    '<div class="screen" id="s-historico">',
    calculationScreen,
  );
  result = replaceSection(
    result,
    '<div class="screen" id="s-historico">',
    '<div class="screen" id="s-matriz">',
    `${historyScreen}\n\n`,
  );
  result = result.replace(/const CS=\{[\s\S]*?function brl\(v\)\{[^\n]+\}\n/, '');
  result = removeSearchDemoData(result);
  result = removeLegacyDetailBehavior(result);
  result = migrateOrders(result);
  result = replaceSection(
    result,
    '<div class="screen" id="s-matriz">',
    '<!-- ═══════════════════════════════════════════════════\n     TELA 6: USUÁRIOS',
    priceListsScreen,
  );
  result = replaceSection(
    result,
    '<!-- ═══════════════════════════════════════════════════\n     TELA 6: USUÁRIOS',
    '</div><!-- /screens -->',
    `${customersScreen}\n\n${usersScreen}`,
  );
  result = result.replace(
    '</div><!-- /screens -->',
    `${productsScreen}\n\n</div><!-- /screens -->`,
  );
  result = replaceSection(
    result,
    '<!-- MODAL: EDITAR USUÁRIO -->',
    '<script>',
    `${customersModals}\n\n${priceListsModals}\n\n${usersModals}`,
  );
  result = replaceSection(
    result,
    '<!-- MODAL: HISTÓRICO DE VERSÕES DO KIT -->',
    '<!-- MODAL: KITS DA MATRIZ -->',
    historyModal,
  );
  result = removeLegacyUsersBehavior(result);
  result = result.replace('<div class="screens">', `<div class="screens">\n${sharedScreens}`);
  result = result.replace('</head>', `${migratedStyles}\n</head>`);
  const bodyEnd = result.lastIndexOf('</body>');
  if (bodyEnd < 0) throw new Error('Fechamento do body não encontrado no protótipo.');
  result = `${result.slice(0, bodyEnd)}<script type="module" src="/src/web/main.ts"></script>\n${result.slice(bodyEnd)}`;
  return result;
}
