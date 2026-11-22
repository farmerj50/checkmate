export function errorField(error: unknown, key: string): unknown {
  return error !== null && typeof error === 'object' && key in error
    ? (error as Record<string, unknown>)[key] : undefined;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const message = errorField(error, 'message');
  return typeof message === 'string' && message ? message : fallback;
}
