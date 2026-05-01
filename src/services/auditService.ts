import { db } from '../config/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryConstraint } from 'firebase/firestore';
import type { AuditLogEntry, AuditAction } from '../types/audit';

const BATCH_SIZE = 50;

export interface AuditFilters {
  startDate?: Date;
  endDate?: Date;
  actionType?: AuditAction;
  actorEmail?: string;
  targetType?: 'user' | 'company' | 'cycle' | 'evaluation' | 'settings' | 'report' | 'careerPath' | 'pendingRegistration' | 'registration';
}

export const auditService = {
  /**
   * Fetch audit logs for a company with optional filters and pagination
   */
  async fetchAuditLogs(
    companyId: string,
    filters: AuditFilters = {},
    pageParam?: any
  ): Promise<{ logs: AuditLogEntry[]; nextPage?: any }> {
    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
      orderBy('timestamp', 'desc'),
    ];

    // Add optional filters
    if (filters.startDate) {
      constraints.push(where('timestamp', '>=', filters.startDate.getTime()));
    }
    if (filters.endDate) {
      constraints.push(where('timestamp', '<=', filters.endDate.getTime()));
    }
    if (filters.actionType) {
      constraints.push(where('action', '==', filters.actionType));
    }
    if (filters.actorEmail) {
      constraints.push(where('actorEmail', '==', filters.actorEmail));
    }
    if (filters.targetType) {
      constraints.push(where('targetType', '==', filters.targetType));
    }

    // Pagination
    if (pageParam) {
      constraints.push(startAfter(pageParam));
    }

    constraints.push(limit(BATCH_SIZE + 1));

    const q = query(collection(db, 'auditLogs'), ...constraints);
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as AuditLogEntry));

    // Determine if there's a next page
    let hasNextPage = false;
    let nextPage = undefined;
    if (docs.length > BATCH_SIZE) {
      hasNextPage = true;
      docs.pop(); // Remove the extra doc used for checking
      nextPage = snapshot.docs[BATCH_SIZE - 1];
    }

    return {
      logs: docs,
      nextPage: hasNextPage ? nextPage : undefined,
    };
  },

  /**
   * Get all unique action types for a company (for filter dropdown)
   */
  async getActionTypes(companyId: string): Promise<AuditAction[]> {
    const q = query(collection(db, 'auditLogs'), where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const actionSet = new Set<AuditAction>();
    snapshot.docs.forEach((doc) => {
      const action = (doc.data() as AuditLogEntry).action;
      if (action) actionSet.add(action);
    });
    return Array.from(actionSet).sort();
  },

  /**
   * Get all unique actor emails for a company (for filter dropdown)
   */
  async getActorEmails(companyId: string): Promise<string[]> {
    const q = query(collection(db, 'auditLogs'), where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const emailSet = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const email = (doc.data() as AuditLogEntry).actorEmail;
      if (email) emailSet.add(email);
    });
    return Array.from(emailSet).sort();
  },

  /**
   * Convert audit logs to CSV format
   */
  logsToCSV(logs: AuditLogEntry[]): string {
    const headers = [
      'Timestamp',
      'Action',
      'Actor Email',
      'Actor Role',
      'Target Type',
      'Target ID',
      'Details',
    ];

    const rows = logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.action,
      log.actorEmail,
      log.actorRole,
      log.targetType,
      log.targetId,
      JSON.stringify(log.metadata || {}),
    ]);

    const csvContent = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  },

  /**
   * Download CSV file
   */
  downloadCSV(logs: AuditLogEntry[], filename = 'audit-trail.csv'): void {
    const csv = this.logsToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Format audit action for display
   */
  formatAction(action: AuditAction): string {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Get color classes for action badge
   */
  getActionColor(action: AuditAction): string {
    switch (action) {
      // Positive / approval actions
      case 'user_approved':
      case 'REGISTRATION_APPROVED':
      case 'user_reactivated':
      case 'EMPLOYEE_REACTIVATED':
      case 'PROMOTION_APPROVED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';

      // Negative / rejection / deactivation actions
      case 'user_rejected':
      case 'REGISTRATION_REJECTED':
      case 'user_deactivated':
      case 'EMPLOYEE_DEACTIVATED':
      case 'COMPANY_DELETION_SCHEDULED':
        return 'bg-red-50 text-red-700 border border-red-200';

      // Warning / change actions
      case 'role_changed':
      case 'EMPLOYEE_ROLE_CHANGED':
      case 'score_overridden':
      case 'SCORE_OVERRIDDEN':
      case 'EMPLOYEE_PROFILE_UPDATED':
      case 'CAREER_PATH_ASSIGNED':
        return 'bg-amber-50 text-amber-700 border border-amber-200';

      // Info / cycle actions
      case 'cycle_created':
      case 'cycle_published':
      case 'cycle_finalized':
      case 'cycle_cancelled':
        return 'bg-blue-50 text-blue-700 border border-blue-200';

      // Neutral / settings / data actions
      case 'company_settings_updated':
      case 'COMPANY_SETTINGS_UPDATED':
      case 'NOTIFICATION_SETTINGS_UPDATED':
      case 'SECURITY_SETTINGS_UPDATED':
      case 'qr_code_regenerated':
      case 'QR_CODE_GENERATED':
      case 'registration_toggled':
      case 'QR_REGISTRATION_TOGGLED':
      case 'data_exported':
      case 'COMPANY_DATA_EXPORTED':
      case 'company_created':
      case 'COMPANY_CREATED':
      case 'company_status_changed':
      case 'company_deleted':
      case 'COMPANY_DELETION_CANCELLED':
      case 'FAIRNESS_REPORT_GENERATED':
      case 'CAREER_PATH_CREATED':
      case 'CAREER_PATH_UPDATED':
      case 'REGISTRATION_INFO_REQUESTED':
      case 'SELF_REGISTRATION_SUBMITTED':
      case 'user_registered':
      case 'user_invited':
      case 'evaluation_submitted':
      case 'EVALUATION_SUBMITTED':
      case 'evaluation_draft_saved':
        return 'bg-slate-50 text-slate-600 border border-slate-200';

      default:
        return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
  },
};
