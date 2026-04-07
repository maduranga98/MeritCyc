import { useEffect, useState } from "react";
import { collection, query, onSnapshot, orderBy, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { type Invite } from "../../types/invite";
import { InviteEmployeeModal } from "../../components/shared/InviteEmployeeModal";
import { BulkImportModal } from "../../components/shared/BulkImportModal";

export default function InviteTracker() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;

    const invitesRef = collection(db, "companies", user.companyId, "invites");
    // Sort by most recent first
    const q = query(invitesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invite[];
      setInvites(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching invites:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.companyId]);

  const handleResend = async (inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const functions = getFunctions();
      const resendInvite = httpsCallable(functions, "resendInvite");
      await resendInvite({ inviteId });
    } catch (error) {
      console.error("Error resending invite:", error);
      alert("Failed to resend invite.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invitation?")) return;

    setActionLoading(inviteId);
    try {
      const functions = getFunctions();
      const revokeInvite = httpsCallable(functions, "revokeInvite");
      await revokeInvite({ inviteId });
    } catch (error) {
      console.error("Error revoking invite:", error);
      alert("Failed to revoke invite.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredInvites = invites.filter(inv =>
    filterStatus === "all" ? true : inv.status === filterStatus
  );

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      accepted: "bg-green-100 text-green-800",
      expired: "bg-gray-100 text-gray-800",
      revoked: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || colors.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (ts: number | Timestamp) => {
    if (!ts) return "N/A";
    const date = typeof ts === 'number' ? new Date(ts) : ts.toDate();
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  };

  if (loading) {
    return <div className="p-8 text-center text-merit-slate">Loading invites...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto font-brand">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-merit-navy">Invite Tracker</h1>
          <p className="text-merit-slate text-sm mt-1">Manage and track employee invitations</p>
        </div>
        <div className="space-x-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2 bg-white border border-gray-300 text-merit-navy font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2 bg-merit-primary text-white font-medium rounded-md hover:bg-merit-primary/90 transition-colors"
          >
            Invite Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 font-medium">Filter Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border-gray-300 rounded-md py-1 pl-3 pr-8 focus:ring-merit-primary focus:border-merit-primary"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Total: {filteredInvites.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No invitations found.
                  </td>
                </tr>
              ) : (
                filteredInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{invite.name}</div>
                          <div className="text-sm text-gray-500">{invite.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">{invite.role}</div>
                      <div className="text-xs text-gray-500">{invite.departmentId || "No Dept"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invite.status)}
                      {invite.status === "pending" && invite.resendCount > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Resent {invite.resendCount}/3
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>Sent: {formatDate(invite.createdAt)}</div>
                      {invite.status === "pending" && (
                        <div className="text-xs mt-1">Exp: {formatDate(invite.expiresAt)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {invite.status === "pending" && (
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => handleResend(invite.id)}
                            disabled={actionLoading === invite.id || invite.resendCount >= 3}
                            className="text-merit-primary hover:text-merit-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleRevoke(invite.id)}
                            disabled={actionLoading === invite.id}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
      />
    </div>
  );
}
