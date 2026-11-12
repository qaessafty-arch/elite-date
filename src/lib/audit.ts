import type pg from 'pg';
import { query } from './db';

export type AuditEntry = {
  actor?: { id: string; email: string } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
};

/** Appends to the audit trail. Sensitive admin and order operations must call this. */
export async function audit(entry: AuditEntry, client?: pg.PoolClient): Promise<void> {
  await query(
    `insert into audit_logs (actor_id, actor_email, action, entity_type, entity_id, details, ip)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.actor?.id ?? null,
      entry.actor?.email ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      JSON.stringify(entry.details ?? {}),
      entry.ip ?? null,
    ],
    client,
  );
}
