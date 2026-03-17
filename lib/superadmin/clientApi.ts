export type ApiSuccess<T> = T & { ok: true };
export type ApiFailure = { ok?: false; error?: string };

export async function fetchJsonOrThrow<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiSuccess<T>> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !payload || payload.ok !== true) {
    const errorMessage = payload && "error" in payload ? payload.error : undefined;
    throw new Error(errorMessage ?? "Error inesperado.");
  }

  return payload;
}
