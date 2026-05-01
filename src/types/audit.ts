// =============================================================================
// MeritCyc Audit Log Types — blueprint rule #3
// Maps to /auditLogs/{id} — append-only, no deletes
// =============================================================================

// NOTE: Backend uses both snake_case and SCREAMING_SNAKE_CASE.
// The union includes every observed action string to remain compatible
// with existing Firestore documents.

export type AuditAction =
  // Company lifecycle
  | "company_created"
  | "COMPANY_CREATED"
  | "company_status_changed"
  | "company_settings_updated"
  | "COMPANY_SETTINGS_UPDATED"
  | "company_deleted"
  | "COMPANY_DELETION_SCHEDULED"
  | "COMPANY_DELETION_CANCELLED"

  // User / employee lifecycle
  | "user_registered"
  | "SELF_REGISTRATION_SUBMITTED"
  | "user_invited"
  | "user_approved"
  | "REGISTRATION_APPROVED"
  | "user_rejected"
  | "REGISTRATION_REJECTED"
  | "user_deactivated"
  | "EMPLOYEE_DEACTIVATED"
  | "user_reactivated"
  | "EMPLOYEE_REACTIVATED"
  | "role_changed"
  | "EMPLOYEE_ROLE_CHANGED"
  | "EMPLOYEE_PROFILE_UPDATED"
  | "REGISTRATION_INFO_REQUESTED"

  // Cycles
  | "cycle_created"
  | "cycle_updated"
  | "cycle_published"
  | "cycle_cancelled"
  | "cycle_finalized"

  // Evaluations
  | "evaluation_submitted"
  | "EVALUATION_SUBMITTED"
  | "evaluation_draft_saved"
  | "score_overridden"
  | "SCORE_OVERRIDDEN"

  // Registration / QR
  | "qr_code_regenerated"
  | "QR_CODE_GENERATED"
  | "registration_toggled"
  | "QR_REGISTRATION_TOGGLED"

  // Data & settings
  | "data_exported"
  | "COMPANY_DATA_EXPORTED"
  | "NOTIFICATION_SETTINGS_UPDATED"
  | "SECURITY_SETTINGS_UPDATED"
  | "FAIRNESS_REPORT_GENERATED"

  // Career paths
  | "CAREER_PATH_CREATED"
  | "CAREER_PATH_UPDATED"
  | "CAREER_PATH_ASSIGNED"
  | "PROMOTION_APPROVED";

export interface AuditLogEntry {
  id: string;
  companyId: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  targetType: "user" | "company" | "cycle" | "evaluation" | "settings" | "report" | "careerPath" | "pendingRegistration" | "registration";
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: number;
}
