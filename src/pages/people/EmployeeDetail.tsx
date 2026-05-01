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
import { employeeService } from '../../services/employeeService';
import { getIncrementStories } from '../../services/incrementStoryService';
import { type IncrementStory } from '../../types/incrementStory';
import { Loader2, ArrowLeft, Mail, Building, Badge, Calendar, LogIn, AlertCircle, Edit2, UserX, UserCheck, Trophy, FileText, TrendingUp, Award } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

type TabType = 'overview' | 'history' | 'activity';

export default function EmployeeDetail() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [employee, setEmployee] = useState<UserProfile | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [incrementStories, setIncrementStories] = useState<IncrementStory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [actionModal, setActionModal] = useState<'deactivate' | 'reactivate' | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const loadData = async () => {
    if (!uid || !currentUser?.companyId) return;

    try {
      if (!['hr_admin', 'super_admin'].includes(currentUser.role || '')) {
        toast.error('Access denied');
        navigate('/people/directory');
        return;
      }

      const empDoc = await getDoc(doc(db, 'users', uid));
      if (!empDoc.exists()) {
        toast.error('Employee not found.');
        navigate('/people/directory');
        return;
      }

      const empData = empDoc.data() as UserProfile;
      if (empData.companyId !== currentUser.companyId) {
        toast.error('Employee not found.');
        navigate('/people/directory');
        return;
      }

      setEmployee(empData);

      const [depts, bands, evalsSnapshot, logsSnapshot1, logsSnapshot2] = await Promise.all([
        departmentService.getDepartments(currentUser.companyId),
        salaryBandService.getSalaryBands(currentUser.companyId),
        getDocs(
          query(
            collection(db, 'evaluations'),
            where('employeeUid', '==', uid),
            where('status', 'in', ['submitted', 'overridden', 'finalized'])
          )
        ),
        getDocs(
          query(
            collection(db, 'auditLogs'),
            where('companyId', '==', currentUser.companyId),
            where('targetId', '==', uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'auditLogs'),
            where('companyId', '==', currentUser.companyId),
            where('actorUid', '==', uid)
          )
        ),
      ]);

      setDepartments(depts);
      setSalaryBands(bands);

      const evals = evalsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));
      setEvaluations(evals.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));

      // Fetch increment stories for richer history display
      try {
        const stories = await new Promise<IncrementStory[]>((resolve) => {
          const unsub = getIncrementStories(uid, (data) => {
            unsub();
            resolve(data);
          });
        });
        setIncrementStories(stories);
      } catch {
        setIncrementStories([]);
      }

      const logs1 = logsSnapshot1.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry));
      const logs2 = logsSnapshot2.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry));
      const allLogs = [...logs1, ...logs2]
        .filter((log, i, arr) => arr.findIndex((l) => l.id === log.id) === i)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      setAuditLogs(allLogs);

      setLoading(false);
    } catch (error) {
      console.error('Error loading employee:', error);
      toast.error('Failed to load employee data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, currentUser?.companyId]);

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

  const getBandDetails = (bandId?: string) => {
    return salaryBands.find((b) => b.id === bandId);
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700';
      case 'hr_admin':
        return 'bg-blue-100 text-blue-700';
      case 'manager':
        return 'bg-amber-100 text-amber-700';
      case 'employee':
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'inactive':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getActionColor = (action: string) => {
    if (['USER_APPROVED', 'USER_REACTIVATED'].some(a => action.includes(a))) {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (['SCORE_OVERRIDDEN', 'ROLE_CHANGED'].some(a => action.includes(a))) {
      return 'bg-amber-50 text-amber-700';
    }
    if (['USER_DEACTIVATED', 'USER_REJECTED'].some(a => action.includes(a))) {
      return 'bg-red-50 text-red-700';
    }
    if (action.includes('CYCLE')) {
      return 'bg-blue-50 text-blue-700';
    }
    return 'bg-slate-50 text-slate-600';
  };

  const getTierBadgeStyle = (tierName: string): { bg: string; text: string } => {
    const name = tierName.toLowerCase();
    if (name.includes('exceptional') || name.includes('outstanding'))
      return { bg: '#059669', text: '#ffffff' };
    if (name.includes('exceed') || name.includes('above'))
      return { bg: '#0284c7', text: '#ffffff' };
    if (name.includes('meet') || name.includes('standard') || name.includes('good'))
      return { bg: '#7c3aed', text: '#ffffff' };
    if (name.includes('develop') || name.includes('below') || name.includes('needs'))
      return { bg: '#d97706', text: '#ffffff' };
    return { bg: '#64748b', text: '#ffffff' };
  };

  const handleStatusChange = async (action: 'deactivate' | 'reactivate') => {
    if (!employee) return;
    setIsSubmittingAction(true);
    try {
      if (action === 'deactivate') {
        await employeeService.deactivateEmployee(employee.uid);
        toast.success('Employee deactivated');
      } else {
        await employeeService.reactivateEmployee(employee.uid);
        toast.success('Employee reactivated');
      }
      setActionModal(null);
      await loadData();
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || 'An error occurred');
    } finally {
      setIsSubmittingAction(false);
    }
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
              {employee.photoURL ? (
                <img
                  src={employee.photoURL}
                  alt={employee.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xl font-bold">
                  {employee.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{employee.name}</h1>
                <p className="text-sm text-slate-500">
                  {employee.jobTitle && <span>{employee.jobTitle}</span>}
                  {employee.jobTitle && employee.departmentId && <span> • </span>}
                  {employee.departmentId && <span>{getDeptName(employee.departmentId)}</span>}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(employee.role)}`}>
                    {employee.role.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(employee.status)}`}>
                    {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {currentUser?.role && ['hr_admin', 'super_admin'].includes(currentUser.role) && (
              <div className="flex gap-2">
                <button
                  onClick={() => toast.info('Edit profile feature coming soon')}
                  className="flex items-center gap-2 border border-slate-300 rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
                {employee.status === 'active' ? (
                  <button
                    onClick={() => setActionModal('deactivate')}
                    className="flex items-center gap-2 bg-red-500 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => setActionModal('reactivate')}
                    className="flex items-center gap-2 bg-emerald-500 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-600 transition-colors"
                  >
                    <UserCheck className="w-4 h-4" />
                    Reactivate
                  </button>
                )}
              </div>
            )}
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
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Email</h3>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium">{employee.email}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Department</h3>
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium">{getDeptName(employee.departmentId)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Salary Band</h3>
                <p className="text-slate-900 font-medium">{getBandName(employee.salaryBandId)}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Role</h3>
                <div className="flex items-center gap-3">
                  <Badge className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium capitalize">{employee.role.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Status</h3>
                <p className="text-slate-900 font-medium capitalize">{employee.status}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Registration Method</h3>
                <p className="text-slate-900 font-medium">{employee.registrationMethod || '—'}</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Member Since</h3>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900 font-medium">
                    {employee.createdAt ? format(new Date(employee.createdAt), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Last Active</h3>
                <p className="text-slate-900 font-medium">
                  {employee.lastActiveAt ? formatDistanceToNow(new Date(employee.lastActiveAt), { addSuffix: true }) : '—'}
                </p>
              </div>
            </div>

            {/* Salary Band Detail Card */}
            {getBandDetails(employee.salaryBandId) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Salary Band Details</h3>
                {(() => {
                  const band = getBandDetails(employee.salaryBandId);
                  if (!band) return null;
                  const currency = band.currency || 'USD';
                  const minSalary = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 0,
                  }).format(band.minSalary);
                  const maxSalary = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 0,
                  }).format(band.maxSalary);
                  return (
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Band Name</p>
                        <p className="text-slate-900 font-medium">{band.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Level</p>
                        <p className="text-slate-900 font-medium">{band.level}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Salary Range</p>
                        <p className="text-slate-900 font-medium">{minSalary} – {maxSalary}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Manager Card */}
            {evaluations.length > 0 && evaluations[0].managerName && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Reports To</h3>
                <p className="text-slate-900 font-medium">{evaluations[0].managerName}</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: Increment History */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {incrementStories.length === 0 && evaluations.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No increment history yet</h3>
                <p className="text-slate-500 max-w-sm mx-auto mb-4">
                  This employee hasn't participated in any completed increment cycles. Their history will appear here once cycles are finalized.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-lg inline-flex">
                  <FileText className="w-4 h-4" />
                  <span>Stories are generated from finalized evaluations</span>
                </div>
              </div>
            ) : incrementStories.length > 0 ? (
              /* Rich increment stories view */
              <div className="divide-y divide-slate-100">
                {incrementStories.map((story) => (
                  <div
                    key={story.cycleId}
                    onClick={() => navigate(`/increments/${story.cycleId}`)}
                    className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-1.5 h-12 rounded-full"
                        style={{ backgroundColor: story.tierColor }}
                      />
                      <div>
                        <p className="font-bold text-slate-900">{story.cycleName}</p>
                        <p className="text-xs text-slate-500">
                          {format(story.cycleStartDate.toDate(), 'MMM d')} – {format(story.cycleEndDate.toDate(), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Score</p>
                        <p className="font-bold text-slate-900">{story.score.toFixed(1)}</p>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ backgroundColor: `${story.tierColor}20`, color: story.tierColor }}
                      >
                        {story.tierName}
                      </span>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Increment</p>
                        <p className="font-bold text-emerald-600">+{story.incrementPercent.toFixed(1)}%</p>
                      </div>
                      {story.incrementAmount && (
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Amount</p>
                          <p className="font-bold text-slate-900">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: story.currency || 'USD',
                              minimumFractionDigits: 0,
                            }).format(story.incrementAmount)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback: raw evaluations table when stories aren't populated yet */
              <div className="overflow-x-auto">
                <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-xs text-amber-700">
                    Increment stories are still being generated. Showing raw evaluation data as fallback.
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Cycle</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Date</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Score</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Tier</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Increment %</th>
                      <th className="px-6 py-4 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evaluations.map((evaluation) => (
                      <tr
                        key={evaluation.id}
                        onClick={() => navigate(`/increments/${evaluation.cycleId}`)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-medium text-slate-900">{evaluation.cycleId}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {evaluation.createdAt && format(evaluation.createdAt.toDate?.() || evaluation.createdAt, 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900">{evaluation.weightedTotalScore?.toFixed(1) || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          {evaluation.assignedTierName ? (() => {
                            const style = getTierBadgeStyle(evaluation.assignedTierName);
                            return (
                              <span
                                className="px-2 py-1 rounded text-xs font-bold"
                                style={{ backgroundColor: style.bg, color: style.text }}
                              >
                                {evaluation.assignedTierName}
                              </span>
                            );
                          })() : (
                            <span className="text-slate-400">—</span>
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
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500">No activity recorded.</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-slate-500">{log.actorEmail}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span title={new Date(log.timestamp).toLocaleString()}>
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
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

      {/* Deactivate/Reactivate Confirmation Modal */}
      {actionModal && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setActionModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              {actionModal === 'deactivate' ? 'Deactivate Employee' : 'Reactivate Employee'}
            </h3>
            <p className="text-slate-600 mb-6 text-sm">
              Are you sure you want to {actionModal} <strong>{employee.name}</strong>?
              {actionModal === 'deactivate'
                ? ' They will immediately lose access to the platform.'
                : ' They will be able to log in again.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActionModal(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(actionModal)}
                disabled={isSubmittingAction}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  actionModal === 'deactivate' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {isSubmittingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm {actionModal}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
