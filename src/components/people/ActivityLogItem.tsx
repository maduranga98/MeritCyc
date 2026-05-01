import { formatDistanceToNow } from 'date-fns';
import {
  UserCog,
  Shield,
  UserX,
  UserCheck,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Mail,
  Building,
  Trophy,
  FileText,
  Briefcase,
  ArrowRight,
  GitCommit,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { type AuditLogEntry, type AuditAction } from '../../types/audit';
import { type Department } from '../../types/department';
import { type SalaryBand } from '../../types/salaryBand';

interface ActivityLogItemProps {
  log: AuditLogEntry;
  departments: Department[];
  salaryBands: SalaryBand[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionMeta(action: AuditAction): {
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  label: string;
} {
  switch (action) {
    // Profile updates
    case 'EMPLOYEE_PROFILE_UPDATED':
      return { icon: UserCog, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', label: 'Profile Updated' };

    // Role changes
    case 'role_changed':
    case 'EMPLOYEE_ROLE_CHANGED':
      return { icon: Shield, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', label: 'Role Changed' };

    // Deactivation
    case 'user_deactivated':
    case 'EMPLOYEE_DEACTIVATED':
      return { icon: UserX, colorClass: 'text-red-600', bgClass: 'bg-red-50', label: 'Account Deactivated' };

    // Reactivation
    case 'user_reactivated':
    case 'EMPLOYEE_REACTIVATED':
      return { icon: UserCheck, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', label: 'Account Reactivated' };

    // Evaluations
    case 'evaluation_submitted':
    case 'EVALUATION_SUBMITTED':
      return { icon: ClipboardCheck, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Evaluation Submitted' };

    case 'score_overridden':
    case 'SCORE_OVERRIDDEN':
      return { icon: AlertTriangle, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', label: 'Score Overridden' };

    // Registration / approval
    case 'user_approved':
    case 'REGISTRATION_APPROVED':
      return { icon: CheckCircle, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', label: 'Registration Approved' };

    case 'user_rejected':
    case 'REGISTRATION_REJECTED':
      return { icon: XCircle, colorClass: 'text-red-600', bgClass: 'bg-red-50', label: 'Registration Rejected' };

    case 'REGISTRATION_INFO_REQUESTED':
      return { icon: Info, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'More Info Requested' };

    case 'SELF_REGISTRATION_SUBMITTED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Self-Registration Submitted' };

    // Invites
    case 'user_invited':
      return { icon: Mail, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Invited' };

    // Cycles
    case 'cycle_finalized':
      return { icon: Trophy, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', label: 'Cycle Finalized' };

    case 'cycle_created':
      return { icon: FileText, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', label: 'Cycle Created' };

    case 'cycle_published':
      return { icon: FileText, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', label: 'Cycle Published' };

    case 'cycle_updated':
      return { icon: FileText, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', label: 'Cycle Updated' };

    case 'cycle_cancelled':
      return { icon: FileText, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', label: 'Cycle Cancelled' };

    // Career
    case 'CAREER_PATH_ASSIGNED':
      return { icon: Briefcase, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', label: 'Career Path Assigned' };

    case 'PROMOTION_APPROVED':
      return { icon: Trophy, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', label: 'Promotion Approved' };

    case 'CAREER_PATH_CREATED':
      return { icon: Briefcase, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Career Path Created' };

    case 'CAREER_PATH_UPDATED':
      return { icon: Briefcase, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Career Path Updated' };

    // Company
    case 'company_created':
    case 'COMPANY_CREATED':
      return { icon: Building, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Company Created' };

    case 'company_deleted':
    case 'COMPANY_DELETION_SCHEDULED':
      return { icon: Building, colorClass: 'text-red-600', bgClass: 'bg-red-50', label: 'Company Deletion Scheduled' };

    case 'COMPANY_DELETION_CANCELLED':
      return { icon: Building, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', label: 'Company Deletion Cancelled' };

    case 'company_status_changed':
      return { icon: Building, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Company Status Changed' };

    case 'company_settings_updated':
    case 'COMPANY_SETTINGS_UPDATED':
      return { icon: Building, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Company Settings Updated' };

    // Data / settings
    case 'data_exported':
    case 'COMPANY_DATA_EXPORTED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Data Exported' };

    case 'NOTIFICATION_SETTINGS_UPDATED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Notification Settings Updated' };

    case 'SECURITY_SETTINGS_UPDATED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Security Settings Updated' };

    case 'FAIRNESS_REPORT_GENERATED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Fairness Report Generated' };

    case 'qr_code_regenerated':
    case 'QR_CODE_GENERATED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'QR Code Generated' };

    case 'registration_toggled':
    case 'QR_REGISTRATION_TOGGLED':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Registration Toggled' };

    case 'evaluation_draft_saved':
      return { icon: FileText, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: 'Evaluation Draft Saved' };

    default:
      return { icon: GitCommit, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', label: action.replace(/_/g, ' ') };
  }
}

function formatRole(role?: string): string {
  if (!role) return '—';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status?: string): string {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getFieldValue(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  return obj[key];
}

function getTimestampMillis(ts: unknown): number {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts === 'object') {
    // Firestore Timestamp
    if ('toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
      return (ts as { toMillis: () => number }).toMillis();
    }
    // Seconds-based timestamp
    if ('seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
      return (ts as { seconds: number }).seconds * 1000;
    }
  }
  return Date.now();
}

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

function renderChange(label: string, before: unknown, after: unknown): string | null {
  if (isEmptyValue(before) && isEmptyValue(after)) return null;
  if (isEmptyValue(before) && !isEmptyValue(after)) return `${label} set to ${String(after)}`;
  if (!isEmptyValue(before) && isEmptyValue(after)) return `${label} removed (was ${String(before)})`;
  if (before !== after) return `${label} changed from ${String(before)} to ${String(after)}`;
  return null;
}

// ---------------------------------------------------------------------------
// Diff renderers for specific actions
// ---------------------------------------------------------------------------

function ProfileUpdateDiff({
  log,
  departments,
  salaryBands,
}: {
  log: AuditLogEntry;
  departments: Department[];
  salaryBands: SalaryBand[];
}) {
  const before = log.before ?? {};
  const after = log.after ?? {};

  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name || id || '—';
  const bandName = (id?: string) => salaryBands.find((b) => b.id === id)?.name || id || '—';

  const changes: string[] = [];

  const oldDept = getFieldValue(before, 'departmentId') as string | undefined;
  const newDept = getFieldValue(after, 'departmentId') as string | undefined;
  const deptChange = renderChange('Department', deptName(oldDept), deptName(newDept));
  if (deptChange) changes.push(deptChange);

  const oldBand = getFieldValue(before, 'salaryBandId') as string | undefined;
  const newBand = getFieldValue(after, 'salaryBandId') as string | undefined;
  const bandChange = renderChange('Salary band', bandName(oldBand), bandName(newBand));
  if (bandChange) changes.push(bandChange);

  const oldTitle = getFieldValue(before, 'jobTitle') as string | undefined;
  const newTitle = getFieldValue(after, 'jobTitle') as string | undefined;
  const titleChange = renderChange('Job title', oldTitle, newTitle);
  if (titleChange) changes.push(titleChange);

  const oldStatus = getFieldValue(before, 'status') as string | undefined;
  const newStatus = getFieldValue(after, 'status') as string | undefined;
  const statusChange = renderChange('Status', formatStatus(oldStatus), formatStatus(newStatus));
  if (statusChange) changes.push(statusChange);

  if (changes.length === 0) {
    return <p className="text-sm text-slate-500">Profile was updated.</p>;
  }

  return (
    <ul className="space-y-1">
      {changes.map((c, i) => (
        <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {c}
        </li>
      ))}
    </ul>
  );
}

function RoleChangeDiff({ log }: { log: AuditLogEntry }) {
  const before = formatRole(String(getFieldValue(log.before, 'role') ?? '—'));
  const after = formatRole(String(getFieldValue(log.after, 'role') ?? '—'));

  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{before}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{after}</span>
    </div>
  );
}

function StatusChangeDiff({ log }: { log: AuditLogEntry }) {
  const before = formatStatus(String(getFieldValue(log.before, 'status') ?? '—'));
  const after = formatStatus(String(getFieldValue(log.after, 'status') ?? '—'));

  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{before}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{after}</span>
    </div>
  );
}

function EvaluationDiff({ log }: { log: AuditLogEntry }) {
  const meta = log.metadata ?? {};
  const cycleId = meta.cycleId as string | undefined;
  const score = meta.score as number | undefined;

  return (
    <div className="space-y-1">
      {cycleId && (
        <p className="text-sm text-slate-700">
          Cycle: <span className="font-medium">{cycleId}</span>
        </p>
      )}
      {typeof score === 'number' && (
        <p className="text-sm text-slate-700">
          Score: <span className="font-medium">{score.toFixed(1)}</span>
        </p>
      )}
    </div>
  );
}

function ScoreOverrideDiff({ log }: { log: AuditLogEntry }) {
  const before = log.before ?? {};
  const after = log.after ?? {};

  const oldScore = getFieldValue(before, 'weightedTotalScore') as number | undefined;
  const newScore = getFieldValue(after, 'weightedTotalScore') as number | undefined;
  const oldTier = getFieldValue(before, 'assignedTierName') as string | undefined;
  const newTier = getFieldValue(after, 'assignedTierName') as string | undefined;
  const reason = getFieldValue(after, 'overrideReason') as string | undefined;

  return (
    <div className="space-y-1">
      {typeof oldScore === 'number' && typeof newScore === 'number' && (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
            Score {oldScore.toFixed(1)}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">
            Score {newScore.toFixed(1)}
          </span>
        </div>
      )}
      {oldTier && newTier && oldTier !== newTier && (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{oldTier}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">{newTier}</span>
        </div>
      )}
      {reason && (
        <p className="text-sm text-slate-500 mt-1">
          Reason: <span className="italic">{reason}</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ActivityLogItem({ log, departments, salaryBands }: ActivityLogItemProps) {
  const meta = getActionMeta(log.action);
  const Icon = meta.icon;

  const timestamp = getTimestampMillis(log.timestamp);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`shrink-0 w-10 h-10 rounded-full ${meta.bgClass} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${meta.colorClass}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <p className="font-semibold text-slate-900">{meta.label}</p>
              <p className="text-xs text-slate-500">
                by <span className="font-medium text-slate-600">{log.actorEmail}</span>
                {' · '}
                <span title={new Date(timestamp).toLocaleString()}>
                  {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                </span>
              </p>
            </div>
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.bgClass} ${meta.colorClass} border-current opacity-80`}
            >
              {log.action.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Action-specific diff */}
          <div className="mt-2">
            {log.action === 'EMPLOYEE_PROFILE_UPDATED' && (
              <ProfileUpdateDiff log={log} departments={departments} salaryBands={salaryBands} />
            )}

            {(log.action === 'role_changed' || log.action === 'EMPLOYEE_ROLE_CHANGED') && (
              <RoleChangeDiff log={log} />
            )}

            {(log.action === 'user_deactivated' || log.action === 'EMPLOYEE_DEACTIVATED') && (
              <StatusChangeDiff log={log} />
            )}

            {(log.action === 'user_reactivated' || log.action === 'EMPLOYEE_REACTIVATED') && (
              <StatusChangeDiff log={log} />
            )}

            {(log.action === 'evaluation_submitted' || log.action === 'EVALUATION_SUBMITTED') && (
              <EvaluationDiff log={log} />
            )}

            {(log.action === 'score_overridden' || log.action === 'SCORE_OVERRIDDEN') && (
              <ScoreOverrideDiff log={log} />
            )}

            {/* Fallback: show metadata if no specific renderer */}
            {log.metadata && Object.keys(log.metadata).length > 0 &&
              ![
                'EMPLOYEE_PROFILE_UPDATED',
                'role_changed',
                'EMPLOYEE_ROLE_CHANGED',
                'user_deactivated',
                'EMPLOYEE_DEACTIVATED',
                'user_reactivated',
                'EMPLOYEE_REACTIVATED',
                'evaluation_submitted',
                'EVALUATION_SUBMITTED',
                'score_overridden',
                'SCORE_OVERRIDDEN',
              ].includes(log.action) && (
                <p className="text-xs text-slate-400">
                  {Object.entries(log.metadata)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(' · ')}
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
