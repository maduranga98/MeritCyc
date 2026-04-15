import { db } from '../config/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryConstraint } from 'firebase/firestore';
import type { AuditLogEntry, AuditAction } from '../types/audit';

const BATCH_SIZE = 50;

export interface AuditFilters {
  startDate?: Date;
  endDate?: Date;
  actionType?: AuditAction;
  actorEmail?: string;
  targetType?: 'user' | 'company' | 'cycle' | 'evaluation' | 'settings';
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
   * Get action color for UI
   */
  getActionColor(
    action: AuditAction
  ): 'red' | 'green' | 'blue' | 'amber' | 'slate' {
    if (
      action.includes('deleted') ||
      action.includes('rejected') ||
      action.includes('deactivated')
    ) {
      return 'red';
    }
    if (
      action.includes('approved') ||
      action.includes('reactivated') ||
      action.includes('created')
    ) {
      return 'green';
    }
    if (action.includes('submitted') || action.includes('finalized')) {
      return 'blue';
    }
    if (action.includes('override')) {
      return 'amber';
    }
    return 'slate';
  },
};
