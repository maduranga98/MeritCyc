import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { departmentService } from "../../services/departmentService";
import { employeeService } from "../../services/employeeService";
import { type Department } from "../../types/department";
import { type Employee } from "../../types/employee";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Building2, Users, AlertCircle, Edit2, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function DepartmentManagement() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Form state
  const [formData, setFormData] = useState({ name: "", managerId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;

    const unsubDepts = departmentService.subscribeToDepartments(user.companyId, (data) => {
      setDepartments(data);
      setLoading(false);
    });

    const unsubEmps = employeeService.subscribeToEmployees(user.companyId, (data) => {
      setEmployees(data);
    });

    return () => {
      unsubDepts();
      unsubEmps();
    };
  }, [user?.companyId]);

  const totalEmployees = departments.reduce((acc, dept) => acc + dept.employeeCount, 0);
  const deptsWithoutManager = departments.filter((d) => !d.managerId).length;

  const columnHelper = createColumnHelper<Department>();

  const columns = [
    columnHelper.accessor("name", {
      header: "Department Name",
      cell: (info) => <span className="font-medium text-merit-navy">{info.getValue()}</span>,
    }),
    columnHelper.accessor("managerId", {
      header: "Manager",
      cell: (info) => {
        const managerId = info.getValue();
        if (!managerId) return <span className="text-slate-400 italic">Not Assigned</span>;
        const manager = employees.find((e) => e.uid === managerId);
        return manager ? <span>{manager.name}</span> : <span className="text-slate-400 italic">Unknown</span>;
      },
    }),
    columnHelper.accessor("employeeCount", {
      header: "Employee Count",
      cell: (info) => <span>{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingDept(info.row.original);
              setFormData({
                name: info.row.original.name,
                managerId: info.row.original.managerId || "",
              });
              setIsPanelOpen(true);
            }}
            className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteDeptId(info.row.original.id)}
            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: departments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Department name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDept) {
        await departmentService.updateDepartment({
          departmentId: editingDept.id,
          name: formData.name,
          managerId: formData.managerId || undefined,
        });
        toast.success("Department updated successfully");
      } else {
        await departmentService.createDepartment({
          name: formData.name,
          managerId: formData.managerId || undefined,
        });
        toast.success("Department created successfully");
      }
      setIsPanelOpen(false);
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDeptId) return;
    try {
      await departmentService.deleteDepartment(deleteDeptId);
      toast.success("Department deleted successfully");
    } catch (err) {
      const e = err as Error;
      if (e.message === "DEPARTMENT_HAS_EMPLOYEES" || e.message.includes("EMPLOYEES")) {
        const dept = departments.find((d) => d.id === deleteDeptId);
        toast.error(`Cannot delete — this department has ${dept?.employeeCount} employees. Reassign them first.`);
      } else {
        toast.error(e.message || "An error occurred while deleting");
      }
    } finally {
      setDeleteDeptId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Eligible managers: users with 'manager' or 'super_admin' role
  const eligibleManagers = employees.filter((e) => e.role === "manager" || e.role === "super_admin");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-merit-navy">Departments</h1>
          <p className="text-slate-500">Manage your company's departments and managers.</p>
        </div>
        <button
          onClick={() => {
            setEditingDept(null);
            setFormData({ name: "", managerId: "" });
            setIsPanelOpen(true);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create Department
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Departments</p>
            <p className="text-2xl font-bold text-merit-navy">{departments.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Employees</p>
            <p className="text-2xl font-bold text-merit-navy">{totalEmployees}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Without Manager</p>
            <p className="text-2xl font-bold text-merit-navy">{deptsWithoutManager}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {departments.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-merit-navy mb-2">No departments yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              Create your first department to start organizing your team.
            </p>
            <button
              onClick={() => {
                setEditingDept(null);
                setFormData({ name: "", managerId: "" });
                setIsPanelOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create your first department
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-6 py-4">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-out Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-merit-navy">
                  {editingDept ? "Edit Department" : "Create Department"}
                </h2>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="dept-form" onSubmit={handleSave} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Department Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Engineering"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Manager</label>
                    <select
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                    >
                      <option value="">None Assigned</option>
                      {eligibleManagers.map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">
                      Only users with Manager or Super Admin roles can be assigned as department heads.
                    </p>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="dept-form"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      {deleteDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteDeptId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold text-merit-navy mb-4">Delete Department</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this department? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDeptId(null)}
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