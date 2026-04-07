import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

interface InviteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InviteEmployeeModal({ isOpen, onClose, onSuccess }: InviteEmployeeModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "manager">("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [salaryBandId, setSalaryBandId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setToast(null);

    try {
      const functions = getFunctions();
      const sendInvite = httpsCallable(functions, "sendEmployeeInvite");

      await sendInvite({
        name,
        email,
        role,
        departmentId,
        salaryBandId,
      });

      setToast(`Invite sent to ${email}`);
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
        // Reset form
        setName("");
        setEmail("");
        setRole("employee");
        setDepartmentId("");
        setSalaryBandId("");
        setToast(null);
      }, 2000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error sending invite:", err);
      setError(err.message || "Failed to send invite.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-brand">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-merit-navy">Invite Employee</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}
          {toast && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-200">
              {toast}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-merit-navy mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-merit-primary/20 focus:border-merit-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-merit-navy mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-merit-primary/20 focus:border-merit-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-merit-navy mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "employee" | "manager")}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-merit-primary/20 focus:border-merit-primary outline-none"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            {/* Department and Salary Band dropdowns would go here,
                ideally populated from Firestore or props */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-merit-navy mb-1">Department</label>
                <input
                  type="text"
                  placeholder="ID (optional)"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-merit-primary/20 focus:border-merit-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-merit-navy mb-1">Salary Band</label>
                <input
                  type="text"
                  placeholder="ID (optional)"
                  value={salaryBandId}
                  onChange={(e) => setSalaryBandId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-merit-primary/20 focus:border-merit-primary outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-merit-primary hover:bg-merit-primary/90 rounded-md transition-colors disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
