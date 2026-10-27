const tableRegionSelector = [
  '.responsive-table-region',
  '.tbl-wrap',
  '.calc-table-wrap',
  '.customers-table-wrap',
  '.approval-table-wrap',
  '.products-composition-body',
  '.price-list-structure-content',
].join(',');

function updateTableRegion(region: HTMLElement): void {
  const maximumScroll = region.scrollWidth - region.clientWidth;
  const scrollable = maximumScroll > 1;
  const endTolerance = 20; // inclui a calha reservada da scrollbar em alguns navegadores
  region.dataset.scrollable = String(scrollable);
  region.dataset.scrollStart = String(!scrollable || region.scrollLeft <= 1);
  region.dataset.scrollEnd = String(
    !scrollable || region.scrollLeft >= maximumScroll - endTolerance,
  );
}

function enhanceTableRegion(region: HTMLElement, resizeObserver: ResizeObserver): void {
  if (region.dataset.responsiveRegion === 'true') {
    updateTableRegion(region);
    return;
  }

  region.dataset.responsiveRegion = 'true';
  region.tabIndex = region.tabIndex >= 0 ? region.tabIndex : 0;
  if (!region.hasAttribute('role')) region.setAttribute('role', 'region');
  if (!region.hasAttribute('aria-label') && !region.hasAttribute('aria-labelledby')) {
    region.setAttribute('aria-label', 'Tabela com rolagem horizontal');
  }
  region.addEventListener('scroll', () => updateTableRegion(region), { passive: true });
  resizeObserver.observe(region);
  updateTableRegion(region);
}

/**
 * Aplica comportamento acessível às regiões compartilhadas que podem rolar.
 * O observer também cobre tabelas renderizadas depois de chamadas à API.
 */
export function initializeResponsiveFoundation(): void {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) updateTableRegion(entry.target as HTMLElement);
  });

  const enhanceWithin = (root: ParentNode): void => {
    if (root instanceof HTMLElement && root.matches(tableRegionSelector)) {
      enhanceTableRegion(root, resizeObserver);
    }
    root
      .querySelectorAll<HTMLElement>(tableRegionSelector)
      .forEach((region) => enhanceTableRegion(region, resizeObserver));
  };

  enhanceWithin(document);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const addedNode of record.addedNodes) {
        if (addedNode instanceof HTMLElement) enhanceWithin(addedNode);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
