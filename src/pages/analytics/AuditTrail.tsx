import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { auditService, type AuditFilters } from '../../services/auditService';
import type { AuditLogEntry, AuditAction } from '../../types/audit';
import { Download, Filter, X } from 'lucide-react';

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
        setPageParam(null);
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

  const getActionColor = (
    action: AuditAction
  ): string => {
    const colorMap: Record<string, string> = {
      red: 'bg-red-50 text-red-700 border-red-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200',
      slate: 'bg-slate-50 text-slate-700 border-slate-200',
    };
    const color = auditService.getActionColor(action);
    return colorMap[color];
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
                {actionTypes.map((action) => (
                  <option key={action} value={action}>
                    {auditService.formatAction(action)}
                  </option>
                ))}
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

      {/* Results Count */}
      <div className="text-sm text-slate-600">
        Showing <span className="font-bold">{logs.length}</span> audit logs
        {hasNextPage && ' (more available)'}
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <div className="inline-block px-4 py-2 bg-slate-100 rounded-lg mb-3">
              Loading...
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="mb-2">No audit logs found matching your filters.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-emerald-600 hover:underline font-bold"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${getActionColor(log.action)}`}>
                          {auditService.formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <div className="text-slate-900 font-medium">{log.actorEmail}</div>
                        <div className="text-xs text-slate-500">{log.actorRole}</div>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <div className="text-slate-900 font-medium capitalize">
                          {log.targetType}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{log.targetId}</div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        {log.metadata
                          ? Object.entries(log.metadata)
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="font-bold">{key}:</span> {String(value).substring(0, 20)}...
                                </div>
                              ))
                          : '—'}
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
    </div>
  );
};

export default AuditTrail;
