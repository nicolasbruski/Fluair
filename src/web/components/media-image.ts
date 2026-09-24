import type { MediaVariant, NullableImageReference } from '../../shared/media.js';

export interface MediaImageOptions {
  image: NullableImageReference;
  variant?: MediaVariant;
  entityLabel: string;
  code: string;
  description: string;
  width: number;
  height: number;
  lazy?: boolean;
  expandable?: boolean;
}

let viewerTrigger: HTMLElement | null = null;

function closeViewer(): void {
  const overlay = document.querySelector<HTMLElement>('#media-image-viewer');
  if (!overlay?.classList.contains('open')) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
  overlay.style.display = 'none';
  const trigger = viewerTrigger;
  viewerTrigger = null;
  trigger?.focus({ preventScroll: true });
}

function viewer(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('#media-image-viewer');
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.id = 'media-image-viewer';
  overlay.className = 'modal-overlay media-image-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-labelledby', 'media-image-viewer-title');
  overlay.hidden = true;
  const dialog = document.createElement('div');
  dialog.className = 'modal media-image-viewer__dialog';
  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('div');
  title.id = 'media-image-viewer-title';
  title.className = 'modal-title';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Fechar imagem ampliada');
  close.textContent = '×';
  close.addEventListener('click', closeViewer);
  const content = document.createElement('div');
  content.className = 'media-image-viewer__content';
  header.append(title, close);
  dialog.append(header, content);
  overlay.append(dialog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeViewer();
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !overlay.classList.contains('open')) return;
      event.preventDefault();
      event.stopPropagation();
      closeViewer();
    },
    true,
  );
  document.body.append(overlay);
  return overlay;
}

function openViewer(options: MediaImageOptions, trigger: HTMLElement): void {
  if (!options.image) return;
  const overlay = viewer();
  const content = overlay.querySelector<HTMLElement>('.media-image-viewer__content')!;
  const title = overlay.querySelector<HTMLElement>('#media-image-viewer-title')!;
  const close = overlay.querySelector<HTMLButtonElement>('.modal-close')!;
  title.textContent = `${options.entityLabel} ${options.code}`;
  content.replaceChildren();
  const image = document.createElement('img');
  image.src = options.image.displayUrl;
  image.alt = `${options.entityLabel} ${options.code} — ${options.description}`;
  image.decoding = 'async';
  image.addEventListener('error', () => {
    const message = document.createElement('p');
    message.className = 'media-image-viewer__error';
    message.textContent = 'Não foi possível carregar esta foto.';
    content.replaceChildren(message);
  });
  content.append(image);
  viewerTrigger = trigger;
  overlay.hidden = false;
  overlay.style.removeProperty('display');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  close.focus();
}

/** Cria uma imagem com área estável e fallback acessível, sem renderizar HTML vindo da API. */
export function createMediaImage(options: MediaImageOptions): HTMLElement {
  const container =
    options.image && options.expandable
      ? document.createElement('button')
      : document.createElement('span');
  container.className = 'media-image';
  container.style.width = `${options.width}px`;
  container.style.height = `${options.height}px`;
  container.style.display = 'inline-grid';
  container.style.placeItems = 'center';
  container.style.overflow = 'hidden';
  container.style.position = 'relative';

  const fallback = document.createElement('span');
  fallback.className = 'media-image__placeholder';
  fallback.textContent = 'Sem foto';
  container.append(fallback);

  if (!options.image) return container;

  // Algumas fotos de catálogo já chegam com o produto encostado no limite do
  // arquivo. Este respiro evita a aparência de recorte sem alterar a imagem.
  const safeInset = Math.max(
    4,
    Math.min(10, Math.round(Math.min(options.width, options.height) * 0.06)),
  );
  container.style.boxSizing = 'border-box';
  container.style.padding = `${safeInset}px`;

  if (container instanceof HTMLButtonElement) {
    container.type = 'button';
    container.classList.add('media-image--expandable');
    container.setAttribute('aria-label', `Ampliar foto de ${options.entityLabel} ${options.code}`);
    container.addEventListener('click', (event) => {
      event.stopPropagation();
      openViewer(options, container);
    });
    container.addEventListener('keydown', (event) => event.stopPropagation());
  }

  const image = document.createElement('img');
  image.className = 'media-image__content';
  image.src = options.variant === 'display' ? options.image.displayUrl : options.image.thumbnailUrl;
  image.alt = `${options.entityLabel} ${options.code} — ${options.description}`;
  image.width = options.width;
  image.height = options.height;
  image.decoding = 'async';
  image.loading = options.lazy === false ? 'eager' : 'lazy';
  image.style.position = 'absolute';
  image.style.top = `${safeInset}px`;
  image.style.left = `${safeInset}px`;
  image.style.width = `calc(100% - ${safeInset * 2}px)`;
  image.style.height = `calc(100% - ${safeInset * 2}px)`;
  image.style.objectFit = 'contain';
  image.style.objectPosition = 'center';
  image.addEventListener('load', () => {
    fallback.hidden = true;
  });
  image.addEventListener('error', () => {
    image.hidden = true;
    fallback.hidden = false;
  });
  container.prepend(image);
  return container;
}
