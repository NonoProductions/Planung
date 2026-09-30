const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ID for a new row. The native apps create records offline and send their own
 * UUID so later changes to the record can be queued before the server knows it.
 */
export function newRowId(clientId: unknown): string {
  return typeof clientId === "string" && UUID_PATTERN.test(clientId)
    ? clientId.toLowerCase()
    : crypto.randomUUID();
}
