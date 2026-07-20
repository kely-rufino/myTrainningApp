// Shared helpers for MCP tool handlers: turn a service call into the
// { content: [...] } shape the MCP protocol expects, translating thrown
// httpErrors (404 not found, 409 conflict, etc.) into an isError result
// instead of letting them blow up the request.

export function ok(data: unknown) {
  const payload = data === undefined ? { ok: true } : data
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] }
}

export function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

export async function run(fn: () => Promise<unknown> | unknown) {
  try {
    return ok(await fn())
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unknown error')
  }
}
