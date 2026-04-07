import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { salaryBandService } from "../../services/salaryBandService";
import { companyService } from "../../services/companyService";
import { type SalaryBand } from "../../types/salaryBand";
import { type Company } from "../../types/company";
import { DollarSign, Edit2, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function SalaryBandManagement() {
  const { user } = useAuth();
  const [bands, setBands] = useState<SalaryBand[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBand, setEditingBand] = useState<SalaryBand | null>(null);

  // Delete modal state
  const [deleteBandId, setDeleteBandId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    level: 1,
    minSalary: 0,
    maxSalary: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;

    const fetchCompany = async () => {
      const c = await companyService.getCompany(user.companyId!);
      setCompany(c);
    };
    fetchCompany();

    const unsub = salaryBandService.subscribeToSalaryBands(user.companyId, (data) => {
      // Sort ascending by level
      setBands(data.sort((a, b) => a.level - b.level));
      setLoading(false);
    });

    return () => unsub();
  }, [user?.companyId]);

  // Check overlap on form change
  useEffect(() => {
    if (formData.minSalary >= formData.maxSalary && formData.maxSalary > 0) {
      setOverlapWarning("Minimum salary must be less than maximum salary.");
      return;
    }

    const hasOverlap = bands.some((b) => {
      if (editingBand && b.id === editingBand.id) return false;
      return Math.max(formData.minSalary, b.minSalary) < Math.min(formData.maxSalary, b.maxSalary);
    });

    if (hasOverlap) {
      setOverlapWarning("Warning: This salary range overlaps with an existing band.");
    } else {
      setOverlapWarning(null);
    }
  }, [formData.minSalary, formData.maxSalary, bands, editingBand]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Band name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingBand) {
        await salaryBandService.updateSalaryBand({
          bandId: editingBand.id,
          name: formData.name,
          level: formData.level,
          minSalary: formData.minSalary,
          maxSalary: formData.maxSalary,
        });
        toast.success("Salary band updated");
      } else {
        await salaryBandService.createSalaryBand({
          name: formData.name,
          level: formData.level,
          minSalary: formData.minSalary,
          maxSalary: formData.maxSalary,
          currency: company?.currency || "USD",
        });
        toast.success("Salary band created");
      }
      setIsModalOpen(false);
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBandId) return;
    try {
      await salaryBandService.deleteSalaryBand(deleteBandId);
      toast.success("Salary band deleted");
    } catch (err) {
      const e = err as Error;
      if (e.message === "BAND_HAS_EMPLOYEES" || e.message.includes("EMPLOYEES")) {
        toast.error("Cannot delete — there are employees currently in this band.");
      } else {
        toast.error(e.message || "An error occurred while deleting");
      }
    } finally {
      setDeleteBandId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: company?.currency || "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-merit-navy">Salary Bands</h1>
          <p className="text-slate-500">Define salary ranges and levels for your organization.</p>
        </div>
        <button
          onClick={() => {
            setEditingBand(null);
            setFormData({
              name: "",
              level: bands.length > 0 ? Math.max(...bands.map((b) => b.level)) + 1 : 1,
              minSalary: 0,
              maxSalary: 0,
            });
            setIsModalOpen(true);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Salary Band
        </button>
      </div>

      {bands.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-merit-navy mb-2">No salary bands yet</h3>
          <p className="text-slate-500 mb-6 max-w-sm">
            Create structured compensation levels to ensure pay equity across your team.
          </p>
          <button
            onClick={() => {
              setEditingBand(null);
              setFormData({ name: "", level: 1, minSalary: 0, maxSalary: 0 });
              setIsModalOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create your first band
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          {/* Visual Ladder */}
          {bands.map((band) => (
            <div
              key={band.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-6 transition-all hover:shadow-md"
            >
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xl">
                L{band.level}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-merit-navy truncate">{band.name}</h3>
                <p className="text-slate-500 font-medium">
                  {formatCurrency(band.minSalary)} — {formatCurrency(band.maxSalary)}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-2 text-slate-500">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">{band.employeeCount || 0} employees</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingBand(band);
                      setFormData({
                        name: band.name,
                        level: band.level,
                        minSalary: band.minSalary,
                        maxSalary: band.maxSalary,
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteBandId(band.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-merit-navy mb-6">
              {editingBand ? "Edit Salary Band" : "Add Salary Band"}
            </h3>

            <div className="overflow-y-auto flex-1 pb-4">
              <form id="band-form" onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Band Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. Senior Engineer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Level <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Levels dictate the hierarchy order (e.g. 1, 2, 3).</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Min Salary ({company?.currency || "USD"}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.minSalary}
                      onChange={(e) => setFormData({ ...formData, minSalary: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Max Salary ({company?.currency || "USD"}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.maxSalary}
                      onChange={(e) => setFormData({ ...formData, maxSalary: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {overlapWarning && (
                  <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200">
                    {overlapWarning}
                  </div>
                )}
              </form>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="band-form"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteBandId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteBandId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold text-merit-navy mb-4">Delete Salary Band</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this salary band? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteBandId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}