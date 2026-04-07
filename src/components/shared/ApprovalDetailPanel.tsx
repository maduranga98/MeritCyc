import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type PendingRegistration } from '../../types/registration';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalDetailPanelProps {
  registration: PendingRegistration | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (data: { pendingId: string; departmentId?: string; salaryBandId?: string; role: 'employee' | 'manager' }) => Promise<void>;
  onReject: (data: { pendingId: string; reason: string }) => Promise<void>;
  onRequestInfo: (data: { pendingId: string; message: string }) => Promise<void>;
}

export const ApprovalDetailPanel: React.FC<ApprovalDetailPanelProps> = ({
  registration,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestInfo,
}) => {
  const [departmentId, setDepartmentId] = useState(registration?.departmentId || '');
  const [salaryBandId, setSalaryBandId] = useState('');
  const [role, setRole] = useState<'employee' | 'manager'>('employee');
  const [rejectReason, setRejectReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showInfoInput, setShowInfoInput] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (registration) {
      setDepartmentId(registration.departmentId || '');
      setSalaryBandId('');
      setRole('employee');
      setRejectReason('');
      setInfoMessage('');
      setShowRejectInput(false);
      setShowInfoInput(false);
    }
  }, [registration]);

  if (!registration) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove({ pendingId: registration.id, departmentId, salaryBandId, role });
      toast.success('Registration approved successfully.');
      onClose();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to approve registration.');
      } else {
        toast.error('Failed to approve registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    setLoading(true);
    try {
      await onReject({ pendingId: registration.id, reason: rejectReason });
      toast.success('Registration rejected.');
      onClose();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to reject registration.');
      } else {
        toast.error('Failed to reject registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!infoMessage.trim()) {
      toast.error('Message is required.');
      return;
    }
    setLoading(true);
    try {
      await onRequestInfo({ pendingId: registration.id, message: infoMessage });
      toast.success('Information requested.');
      onClose();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to request information.');
      } else {
        toast.error('Failed to request information.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col font-brand"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-slate-900">Registration Details</h2>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{registration.name}</h3>
                <p className="text-slate-500">{registration.email}</p>
                <p className="text-slate-500 text-sm mt-1">{registration.jobTitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Registered At</p>
                  <p className="font-medium text-slate-900">
                    {registration.createdAt.toDate().toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Method</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    QR Scan / Manual Code
                  </span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="font-medium text-slate-900">Assignment Details</h4>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder="Department ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Salary Band (Optional)
                  </label>
                  <input
                    type="text"
                    value={salaryBandId}
                    onChange={(e) => setSalaryBandId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder="Salary Band ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'employee' | 'manager')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>

              {showRejectInput && (
                <div className="p-4 bg-red-50 rounded-lg space-y-3">
                  <label className="block text-sm font-medium text-red-900">
                    Reason for Rejection
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-200 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    rows={3}
                    placeholder="This will be sent to the user..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={loading || !rejectReason.trim()}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-3 py-1.5 bg-white text-red-700 text-sm font-medium border border-red-200 rounded-md hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showInfoInput && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                  <label className="block text-sm font-medium text-blue-900">
                    Request Information
                  </label>
                  <textarea
                    value={infoMessage}
                    onChange={(e) => setInfoMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    rows={3}
                    placeholder="Message to the user..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestInfo}
                      disabled={loading || !infoMessage.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Send Request'}
                    </button>
                    <button
                      onClick={() => setShowInfoInput(false)}
                      className="px-3 py-1.5 bg-white text-blue-700 text-sm font-medium border border-blue-200 rounded-md hover:bg-blue-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-slate-50 flex flex-col gap-3">
              {!showRejectInput && !showInfoInput && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 text-white font-semibold rounded-lg shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Approving...' : 'Approve Registration'}
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowInfoInput(true); setShowRejectInput(false); }}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                      Request Info
                    </button>
                    <button
                      onClick={() => { setShowRejectInput(true); setShowInfoInput(false); }}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 bg-white border border-red-200 text-red-600 font-semibold rounded-lg shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
