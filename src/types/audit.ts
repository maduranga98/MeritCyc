// =============================================================================
// MeritCyc Audit Log Types — blueprint rule #3
// Maps to /auditLogs/{id} — append-only, no deletes
// =============================================================================

export type AuditAction =
  | "company_created"
  | "company_status_changed"
  | "company_settings_updated"
  | "company_deleted"
  | "user_registered"
  | "user_invited"
  | "user_approved"
  | "user_rejected"
  | "user_deactivated"
  | "user_reactivated"
  | "role_changed"
  | "cycle_created"
  | "cycle_updated"
  | "cycle_published"
  | "cycle_cancelled"
  | "cycle_finalized"
  | "evaluation_submitted"
  | "evaluation_draft_saved"
  | "score_overridden"
  | "qr_code_regenerated"
  | "registration_toggled"
  | "data_exported";

export interface AuditLogEntry {
  id: string;
  companyId: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  targetType: "user" | "company" | "cycle" | "evaluation" | "settings";
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: number;
}
