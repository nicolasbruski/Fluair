interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends RequestInit {
  notifyAuthenticationFailure?: boolean;
}

export async function apiRequest<T>(
  path: string,
  { notifyAuthenticationFailure = true, ...options }: ApiRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'O sistema está temporariamente indisponível. Tente novamente.',
    );
  }

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    const error = new ApiError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Não foi possível concluir a operação.',
      body.error?.fieldErrors ?? {},
    );
    if (response.status === 401 && notifyAuthenticationFailure) {
      window.dispatchEvent(new CustomEvent('fluair:session-expired', { detail: error }));
    }
    throw error;
  }
  return body;
}
