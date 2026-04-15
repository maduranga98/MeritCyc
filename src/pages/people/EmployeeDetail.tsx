import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { type UserProfile } from '../../types/user';
import { type Evaluation } from '../../types/evaluation';
import { type AuditLogEntry } from '../../types/audit';
import { type Department } from '../../types/department';
import { type SalaryBand } from '../../types/salaryBand';
import { departmentService } from '../../services/departmentService';
import { salaryBandService } from '../../services/salaryBandService';
import { Loader2, ArrowLeft, Mail, Building, Badge, Calendar, Shield, LogIn, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

type TabType = 'overview' | 'history' | 'activity';

export default function EmployeeDetail() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [employee, setEmployee] = useState<UserProfile | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Load employee data
  useEffect(() => {
    if (!uid || !currentUser?.companyId) return;

    const loadData = async () => {
      try {
        // Check if user has access (must be hr_admin or super_admin)
        if (!['hr_admin', 'super_admin'].includes(currentUser.role || '')) {
          toast.error('Access denied');
          navigate('/people/directory');
          return;
        }

        // Load employee
        const empDoc = await getDoc(doc(db, 'users', uid));
        if (!empDoc.exists()) {
          toast.error('Employee not found');
          navigate('/people/directory');
          return;
        }

        const empData = empDoc.data() as UserProfile;
        if (empData.companyId !== currentUser.companyId) {
          toast.error('Employee not found in your company');
          navigate('/people/directory');
          return;
        }

        setEmployee(empData);

        // Load departments and salary bands
        const depts = await departmentService.getDepartments(currentUser.companyId);
        setDepartments(depts);

        const bands = await salaryBandService.getSalaryBands(currentUser.companyId);
        setSalaryBands(bands);

        // Load evaluations
        const evalsSnapshot = await getDocs(
          query(
            collection(db, 'evaluations'),
            where('employeeId', '==', uid),
            where('status', 'in', ['submitted', 'overridden', 'finalized'])
          )
        );
        const evals = evalsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));
        setEvaluations(evals.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));

        // Load audit logs
        const logsSnapshot = await getDocs(
          query(
            collection(db, 'auditLogs'),
            where('companyId', '==', currentUser.companyId)
          )
        );
        const allLogs = logsSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as AuditLog))
          .filter((log) => log.targetId === uid || log.actorUid === uid)
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
          .slice(0, 50);
        setAuditLogs(allLogs);

        setLoading(false);
      } catch (error) {
        console.error('Error loading employee:', error);
        toast.error('Failed to load employee data');
        setLoading(false);
      }
    };

    loadData();
  }, [uid, currentUser, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Employee not found</h2>
        <button
          onClick={() => navigate('/people/directory')}
          className="mt-4 text-emerald-600 hover:text-emerald-700 font-semibold"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const getDeptName = (deptId?: string) => {
    return departments.find((d) => d.id === deptId)?.name || deptId || '—';
  };

  const getBandName = (bandId?: string) => {
    return salaryBands.find((b) => b.id === bandId)?.name || bandId || '—';
  };

  const getActionColor = (action: string) => {
    if (action.includes('APPROVED')) return 'bg-emerald-100 text-emerald-700';
    if (action.includes('OVERRIDDEN')) return 'bg-amber-100 text-amber-700';
    if (action.includes('CHANGED') || action.includes('UPDATED')) return 'bg-blue-100 text-blue-700';
    if (action.includes('DEACTIVATED') || action.includes('REJECTED')) return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-50 font-brand">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate('/people/directory')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </button>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-bold">
                {employee.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{employee.name}</h1>
                <p className="text-slate-500">{getDeptName(employee.departmentId)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {employee.status === 'active' && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                  Active
                </span>
              )}
              {employee.status === 'inactive' && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  Inactive
                </span>
              )}
              {employee.role === 'manager' && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  Manager
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-8">
            {(['overview', 'history', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 font-semibold text-sm border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'text-emerald-600 border-emerald-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                {tab === 'overview' && 'Overview'}
                {tab === 'history' && 'Increment History'}
                {tab === 'activity' && 'Activity'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ================================================================= */}
        {/* TAB 1: Overview */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Email
                </h3>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium">{employee.email}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Department
                </h3>
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium">{getDeptName(employee.departmentId)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Salary Band
                </h3>
                <p className="text-slate-900 font-medium">{getBandName(employee.salaryBandId)}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Role
                </h3>
                <div className="flex items-center gap-3">
                  <Badge className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium capitalize">{employee.role}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Status
                </h3>
                <p className="text-slate-900 font-medium capitalize">{employee.status}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Member Since
                </h3>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium">
                    {employee.createdAt
                      ? format(employee.createdAt.toDate(), 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Manager Card */}
            {employee.managerId && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Reports To
                </h3>
                <p className="text-slate-900 font-medium">{employee.managerName || employee.managerId}</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: Increment History */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {evaluations.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500">No increment cycles yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Cycle Name</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Period</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Score</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Tier</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Increment %</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evaluations.map((evaluation) => (
                      <tr key={evaluation.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4 font-medium text-slate-900">{evaluation.cycleName}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {evaluation.createdAt && format(evaluation.createdAt.toDate(), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900">{evaluation.weightedTotalScore?.toFixed(1) || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          {evaluation.assignedTierName && (
                            <span className="px-2 py-1 rounded text-white text-xs font-bold bg-slate-600">
                              {evaluation.assignedTierName}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {evaluation.incrementPercent ? `${evaluation.incrementPercent}%` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {evaluation.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: Activity */}
        {/* ================================================================= */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {auditLogs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500">No activity recorded</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{log.action}</p>
                      <p className="text-sm text-slate-500">{log.actorEmail}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span title={log.createdAt?.toDate().toLocaleString()}>
                      {log.createdAt && formatDistanceToNow(log.createdAt.toDate(), { addSuffix: true })}
                    </span>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="text-slate-400">
                        {Object.entries(log.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' • ')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
