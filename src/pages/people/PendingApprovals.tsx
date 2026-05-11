import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { type PendingRegistration } from '../../types/registration';
import { ApprovalDetailPanel } from '../../components/shared/ApprovalDetailPanel';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const columnHelper = createColumnHelper<PendingRegistration>();

export default function PendingApprovals() {
  const { user } = useAuth();
  const [data, setData] = useState<PendingRegistration[]>([]);
  const [allData, setAllData] = useState<PendingRegistration[]>([]);
  const [historyData, setHistoryData] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [rowSelection, setRowSelection] = useState({});
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const [stats, setStats] = useState({ approvedToday: 0, rejected7d: 0, avgWaitTimeHours: 0 });

  // Real-time pending data and stats
  useEffect(() => {
    if (!user || !user.companyId) return;

    const qPending = query(
      collection(db, 'companies', user.companyId, 'pendingRegistrations'),
      where('status', 'in', ['pending_approval', 'info_requested'])
    );

    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
      const pending: PendingRegistration[] = [];
      snapshot.forEach((doc) => {
        pending.push({ id: doc.id, ...doc.data() } as PendingRegistration);
      });
      setAllData(pending);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending registrations:', error);
      toast.error('Failed to load pending registrations.');
      setLoading(false);
    });

    // Fetch stats
    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);

        const qApprovedToday = query(
          collection(db, 'companies', user.companyId, 'pendingRegistrations'),
          where('status', '==', 'approved'),
          where('approvedAt', '>=', today)
        );
        const approvedSnap = await getDocs(qApprovedToday);

        const qRejected7d = query(
          collection(db, 'companies', user.companyId, 'pendingRegistrations'),
          where('status', '==', 'rejected'),
          where('rejectedAt', '>=', sevenDaysAgo)
        );
        const rejectedSnap = await getDocs(qRejected7d);

        let totalWaitTimeHours = 0;
        let validApprovedCount = 0;
        approvedSnap.forEach(doc => {
          const d = doc.data() as PendingRegistration;
          if (d.createdAt && d.approvedAt) {
            const waitTimeMs = d.approvedAt.toMillis() - d.createdAt.toMillis();
            totalWaitTimeHours += waitTimeMs / (1000 * 60 * 60);
            validApprovedCount++;
          }
        });

        setStats({
          approvedToday: approvedSnap.size,
          rejected7d: rejectedSnap.size,
          avgWaitTimeHours: validApprovedCount > 0 ? totalWaitTimeHours / validApprovedCount : 0
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };
    fetchStats();

    return () => unsubscribePending();
  }, [user]);

  // Load history data (paginated)
  const loadHistory = async (isLoadMore = false) => {
    if (!user || !user.companyId || loadingHistory || (!hasMoreHistory && isLoadMore)) return;

    setLoadingHistory(true);
    try {
      let qHistory = query(
        collection(db, 'companies', user.companyId, 'pendingRegistrations'),
        where('status', 'in', ['approved', 'rejected']),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (isLoadMore && lastDoc) {
        qHistory = query(qHistory, startAfter(lastDoc));
      }

      const snap = await getDocs(qHistory);
      const newDocs: PendingRegistration[] = [];
      snap.forEach(doc => {
        newDocs.push({ id: doc.id, ...doc.data() } as PendingRegistration);
      });

      if (snap.docs.length > 0) {
        setLastDoc(snap.docs[snap.docs.length - 1]);
      }

      if (snap.docs.length < 20) {
        setHasMoreHistory(false);
      }

      if (isLoadMore) {
        setHistoryData(prev => [...prev, ...newDocs]);
      } else {
        setHistoryData(newDocs);
      }
    } catch (err) {
      console.error("Error loading history:", err);
      toast.error('Failed to load history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && historyData.length === 0) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const currentList = activeTab === 'pending' ? allData : historyData;
    let filtered = currentList;
    if (filterStatus !== 'All') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(
        item => item.name.toLowerCase().includes(lowerQ) || item.email.toLowerCase().includes(lowerQ)
      );
    }
    setData(filtered);
  }, [allData, historyData, filterStatus, searchQuery, activeTab]);

  const functions = getFunctions();

  const handleApprove = async (d: { pendingId: string; departmentId?: string; salaryBandId?: string; role: 'employee' | 'manager' }) => {
    const approveRegistration = httpsCallable(functions, 'approveRegistration');
    await approveRegistration(d);
  };

  const handleReject = async (d: { pendingId: string; reason: string }) => {
    const rejectRegistration = httpsCallable(functions, 'rejectRegistration');
    await rejectRegistration(d);
  };

  const handleRequestInfo = async (d: { pendingId: string; message: string }) => {
    const requestMoreInfo = httpsCallable(functions, 'requestMoreInfo');
    await requestMoreInfo(d);
  };

  const handleBulkApprove = async () => {
    const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id as keyof typeof rowSelection]);
    if (selectedIds.length === 0) return;
    const realIds = selectedIds.map(idx => data[Number(idx)].id);

    try {
      const bulkApprove = httpsCallable(functions, 'bulkApprove');
      toast.loading(`Approving ${realIds.length} employees...`);
      const res = await bulkApprove({ pendingIds: realIds });
      toast.dismiss();
      toast.success(`Done! ${(res.data as { approved: number }).approved} approved.`);
      setRowSelection({});
    } catch (e: unknown) {
      toast.dismiss();
      if (e instanceof Error) {
        toast.error(e.message || 'Bulk approve failed.');
      } else {
        toast.error('Bulk approve failed.');
      }
    }
  };

  const handleBulkReject = async () => {
    const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id as keyof typeof rowSelection]);
    if (selectedIds.length === 0) return;
    const realIds = selectedIds.map(idx => data[Number(idx)].id);

    const reason = window.prompt("Reason for rejection:");
    if (!reason) {
      toast.error('Rejection reason is mandatory.');
      return;
    }

    try {
      const bulkReject = httpsCallable(functions, 'bulkReject');
      toast.loading(`Rejecting ${realIds.length} employees...`);
      const res = await bulkReject({ pendingIds: realIds, reason });
      toast.dismiss();
      toast.success(`Done! ${(res.data as { rejected: number }).rejected} rejected.`);
      setRowSelection({});
    } catch (e: unknown) {
      toast.dismiss();
      if (e instanceof Error) {
        toast.error(e.message || 'Bulk reject failed.');
      } else {
        toast.error('Bulk reject failed.');
      }
    }
  };

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => (
        <div>
          <div className="font-medium text-slate-900">{info.getValue()}</div>
          <div className="text-sm text-slate-500">{info.row.original.email}</div>
        </div>
      )
    }),
    columnHelper.accessor('departmentId', {
      header: 'Department',
      cell: info => info.getValue() || 'Not assigned'
    }),
    columnHelper.accessor('jobTitle', {
      header: 'Job Title',
      cell: info => info.getValue() || 'Not specified'
    }),
    columnHelper.accessor('createdAt', {
      header: 'Registered',
      cell: info => formatDistanceToNow(info.getValue().toDate(), { addSuffix: true })
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => {
        const status = info.getValue();
        if (status === 'pending_approval') return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">Pending</span>;
        if (status === 'info_requested') return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Info Requested</span>;
        return <span>{status}</span>;
      }
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => (
        <button
          onClick={() => {
            setSelectedRegistration(row.original);
            setIsPanelOpen(true);
          }}
          className="text-sm text-slate-600 hover:text-emerald-600 font-medium"
        >
          View Details
        </button>
      )
    })
  ], []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  const selectedCount = Object.keys(rowSelection).filter(id => rowSelection[id as keyof typeof rowSelection]).length;

  return (
    <div className="p-8 font-brand max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pending Approvals</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{allData.filter(d => d.status === 'pending_approval').length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">Approved Today</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.approvedToday}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">Rejected (7d)</div>
          <div className="text-2xl font-bold text-red-600">{stats.rejected7d}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">Avg Wait Time</div>
          <div className="text-2xl font-bold text-slate-900">{stats.avgWaitTimeHours.toFixed(1)}h</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Pending & Info Requested
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Approval History
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-t-xl border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search name or email"
            className="px-3 py-1.5 border border-slate-200 rounded-md text-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select
            className="px-3 py-1.5 border border-slate-200 rounded-md text-sm"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            {activeTab === 'pending' ? (
              <>
                <option value="pending_approval">Pending</option>
                <option value="info_requested">Info Requested</option>
              </>
            ) : (
              <>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {activeTab === 'pending' && selectedCount > 0 && (
        <div className="bg-emerald-50 p-3 flex items-center justify-between border-b border-emerald-100">
          <div className="text-sm font-medium text-emerald-800">{selectedCount} selected</div>
          <div className="flex gap-3">
            <button onClick={handleBulkApprove} className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
              Approve All
            </button>
            <button onClick={handleBulkReject} className="text-sm px-3 py-1 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50">
              Reject All
            </button>
            <button onClick={() => setRowSelection({})} className="text-sm text-slate-500 hover:text-slate-700">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow-sm rounded-b-xl border border-t-0 border-slate-100 overflow-hidden">
        {(activeTab === 'pending' && loading) || (activeTab === 'history' && loadingHistory && data.length === 0) ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No registrations found.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="p-4 font-medium">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* Load More Button for History */}
        {activeTab === 'history' && hasMoreHistory && data.length > 0 && (
          <div className="p-4 border-t border-slate-100 text-center">
            <button
              onClick={() => loadHistory(true)}
              disabled={loadingHistory}
              className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {loadingHistory ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      <ApprovalDetailPanel
        registration={selectedRegistration}
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); setSelectedRegistration(null); }}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestInfo={handleRequestInfo}
      />
    </div>
  );
}
