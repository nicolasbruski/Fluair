export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}
