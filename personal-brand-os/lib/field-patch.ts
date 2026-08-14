/**
 * Builds a single-key update payload from a dynamic (whitelisted-at-runtime)
 * field name, typed against the target table's own Update shape.
 *
 * `{ [field]: value }` alone types as a generic string-indexed object
 * whenever `field`'s type is a union of literals rather than one literal —
 * which every `update<Table>Field(id, field, value)` action in lib/actions/
 * hits, since `field` is exactly that kind of union. postgrest-js's
 * `RejectExcessProperties` then rejects it. A plain `Record<Field, V>` isn't
 * right either — it forces every possible field to share one value type
 * (e.g. `string | null`), which breaks for columns that don't allow null
 * (`title`, `type`, `meeting_date` — NOT NULL columns in the migration).
 *
 * Casting directly to the target table's `Update` type (via the generic
 * `T`) is what actually reflects reality: exactly one key is set at
 * runtime, and every caller validates `field` against a `FIELDS` whitelist
 * before reaching this point — see lib/actions/*.ts.
 */
export function fieldPatch<T>(field: string, value: unknown): Partial<T> {
  return { [field]: value } as Partial<T>;
}
