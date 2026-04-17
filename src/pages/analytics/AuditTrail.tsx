import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { auditService, type AuditFilters } from '../../services/auditService';
import type { AuditLogEntry, AuditAction } from '../../types/audit';
import { Download, Filter, X, Copy, FileText } from 'lucide-react';

const AuditTrail: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [actionTypes, setActionTypes] = useState<AuditAction[]>([]);
  const [actorEmails, setActorEmails] = useState<string[]>([]);
  const [pageParam, setPageParam] = useState<any>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [allLogs, setAllLogs] = useState<AuditLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [actionsRes, emailsRes] = await Promise.all([
          auditService.getActionTypes(user.companyId!),
          auditService.getActorEmails(user.companyId!),
        ]);
        setActionTypes(actionsRes);
        setActorEmails(emailsRes);
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };

    loadInitialData();
  }, [user?.companyId]);

  useEffect(() => {
    if (!user?.companyId) return;

    const loadLogs = async () => {
      try {
        setLoading(true);
        const result = await auditService.fetchAuditLogs(user.companyId!, filters);
        setLogs(result.logs);
        setAllLogs(result.logs); // Keep track of all loaded logs for export
        setPageParam(result.nextPage || null);
        setHasNextPage(!!result.nextPage);
      } catch (err) {
        console.error('Error loading audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [user?.companyId, filters]);

  const handleLoadMore = async () => {
    if (!user?.companyId || !pageParam) return;

    try {
      setLoading(true);
      const result = await auditService.fetchAuditLogs(
        user.companyId!,
        filters,
        pageParam
      );
      setLogs((prev) => [...prev, ...result.logs]);
      setAllLogs((prev) => [...prev, ...result.logs]);
      setPageParam(result.nextPage || null);
      setHasNextPage(!!result.nextPage);
    } catch (err) {
      console.error('Error loading more logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof AuditFilters, value: any) => {
    setFilters((prev) => {
      if (value === null || value === '') {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleExportCSV = () => {
    auditService.downloadCSV(
      allLogs,
      `audit-trail-${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const clearFilters = () => {
    setFilters({});
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year} · ${hours}:${minutes}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-brand pb-12">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-merit-navy mb-1">Audit Trail</h1>
          <p className="text-slate-600">
            Track all system actions and changes across your company
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-bold text-merit-navy hover:text-merit-emerald"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
              {Object.keys(filters).length} active
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">
                Start Date
              </label>
              <input
                type="date"
                value={
                  filters.startDate
                    ? filters.startDate.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  handleFilterChange(
                    'startDate',
                    e.target.value ? new Date(e.target.value) : null
                  )
                }
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">
                End Date
              </label>
              <input
                type="date"
                value={
                  filters.endDate
                    ? filters.endDate.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  handleFilterChange(
                    'endDate',
                    e.target.value ? new Date(e.target.value) : null
                  )
                }
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            {/* Action Type */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">
                Action Type
              </label>
              <select
                value={filters.actionType || ''}
                onChange={(e) =>
                  handleFilterChange('actionType', e.target.value || null)
                }
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Actions</option>
                <optgroup label="User Lifecycle">
                  <option value="user_approved">User Approved</option>
                  <option value="user_rejected">User Rejected</option>
                  <option value="user_deactivated">User Deactivated</option>
                  <option value="user_reactivated">User Reactivated</option>
                  <option value="role_changed">Role Changed</option>
                </optgroup>
                <optgroup label="Cycle Lifecycle">
                  <option value="cycle_created">Cycle Created</option>
                  <option value="cycle_published">Cycle Published</option>
                  <option value="cycle_cancelled">Cycle Cancelled</option>
                  <option value="cycle_finalized">Cycle Finalized</option>
                </optgroup>
                <optgroup label="Evaluations">
                  <option value="evaluation_submitted">Evaluation Submitted</option>
                  <option value="evaluation_draft_saved">Evaluation Draft Saved</option>
                  <option value="score_overridden">Score Overridden</option>
                </optgroup>
                <optgroup label="Settings">
                  <option value="company_settings_updated">Company Settings Updated</option>
                  <option value="qr_code_regenerated">QR Code Regenerated</option>
                  <option value="registration_toggled">Registration Toggled</option>
                </optgroup>
              </select>
            </div>

            {/* Actor Email */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">
                Actor
              </label>
              <select
                value={filters.actorEmail || ''}
                onChange={(e) =>
                  handleFilterChange('actorEmail', e.target.value || null)
                }
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Actors</option>
                {actorEmails.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Type */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">
                Target Type
              </label>
              <select
                value={filters.targetType || ''}
                onChange={(e) =>
                  handleFilterChange('targetType', e.target.value || null)
                }
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Types</option>
                <option value="user">User</option>
                <option value="company">Company</option>
                <option value="cycle">Cycle</option>
                <option value="evaluation">Evaluation</option>
                <option value="settings">Settings</option>
              </select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" /> Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Count & 500-Doc Cap Warning */}
      <div className="space-y-3">
        <div className="text-sm text-slate-600">
          Showing <span className="font-bold">{logs.length}</span> audit logs
          {hasNextPage && ' (more available)'}
        </div>
        {logs.length >= 500 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-lg">
            Showing the most recent 500 entries. Use date filters to narrow results.
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading && logs.length === 0 ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Actor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                      <td className="px-6 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-32" /></td>
                      <td className="px-6 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                      <td className="px-6 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-28" /></td>
                      <td className="px-6 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No audit logs found</p>
            <p className="text-sm text-slate-400">Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Actor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap" title={typeof log.timestamp === 'number' && !isNaN(log.timestamp) ? new Date(log.timestamp).toISOString() : ''}>
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <div className="text-slate-600">{log.actorEmail}</div>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${auditService.getActionColor(log.action)}`}>
                          {auditService.formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <div className="flex items-center gap-2 group">
                          <div>
                            <div className="text-slate-900 font-medium capitalize">{log.targetType}</div>
                            <div className="text-xs text-slate-500 font-mono">{log.targetId.substring(0, 8)}...</div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(log.targetId)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 rounded"
                            title="Copy ID"
                          >
                            <Copy className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(log.metadata)
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <div key={key} className="text-xs text-slate-400">
                                  <span className="font-medium">{key}:</span> {String(value).substring(0, 20)}
                                </div>
                              ))}
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold mt-1"
                            >
                              View Details
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="p-4 border-t border-slate-200 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More Results'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-merit-navy">Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <pre className="bg-slate-50 p-4 rounded-lg text-xs overflow-x-auto font-mono text-slate-700">
              {JSON.stringify(selectedLog.metadata || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrail;
