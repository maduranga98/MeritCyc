import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { employeeService } from "../../services/employeeService";
import { departmentService } from "../../services/departmentService";
import { salaryBandService } from "../../services/salaryBandService";
import { type Employee } from "../../types/employee";
import { type Department } from "../../types/department";
import { type SalaryBand } from "../../types/salaryBand";
import { type RoleCode, ROLES } from "../../types/roles";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Users, Search, Filter, X, ChevronLeft, ChevronRight, Loader2, UserX, UserCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function EmployeeDirectory() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [globalFilter, setGlobalFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Panel state
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Panel form state
  const [formData, setFormData] = useState({
    departmentId: "",
    salaryBandId: "",
    jobTitle: "",
    role: "" as RoleCode | "",
  });

  // Action Modals
  const [actionModal, setActionModal] = useState<'deactivate' | 'reactivate' | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;

    const unsubEmps = employeeService.subscribeToEmployees(user.companyId, (data) => {
      setEmployees(data);
      setLoading(false);
      // update selected employee if panel is open
      if (selectedEmp) {
          const updated = data.find(e => e.uid === selectedEmp.uid);
          if (updated) setSelectedEmp(updated);
      }
    });

    const unsubDepts = departmentService.subscribeToDepartments(user.companyId, setDepartments);
    const unsubBands = salaryBandService.subscribeToSalaryBands(user.companyId, setSalaryBands);

    return () => {
      unsubEmps();
      unsubDepts();
      unsubBands();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId, selectedEmp?.uid]);

  // Derived stats
  const activeCount = employees.filter((e) => e.status === "active").length;
  const inactiveCount = employees.filter((e) => e.status === "inactive").length;
  const pendingCount = employees.filter((e) => e.status === "pending").length;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800";
      case "hr_admin":
        return "bg-emerald-100 text-emerald-800";
      case "manager":
        return "bg-blue-100 text-blue-800";
      case "employee":
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">{t('people.status.active')}</span>;
      case "inactive":
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">{t('people.status.inactive')}</span>;
      case "pending":
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{t('people.status.pending')}</span>;
      default:
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  const getAvatarColor = (role: string) => {
    if (role === 'hr_admin' || role === 'super_admin') return 'bg-emerald-500';
    if (role === 'manager') return 'bg-blue-500';
    return 'bg-slate-400';
  };

  const filteredData = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        emp.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
        emp.email.toLowerCase().includes(globalFilter.toLowerCase());
      const matchDept = deptFilter ? emp.departmentId === deptFilter : true;
      const matchRole = roleFilter ? emp.role === roleFilter : true;
      const matchStatus = statusFilter ? emp.status === statusFilter : true;
      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [employees, globalFilter, deptFilter, roleFilter, statusFilter]);

  const salaryBandNameById = useMemo(() => {
    return salaryBands.reduce<Record<string, string>>((acc, band) => {
      acc[band.id] = band.name;
      return acc;
    }, {});
  }, [salaryBands]);

  const columnHelper = createColumnHelper<Employee>();

  const columns = [
    columnHelper.accessor("name", {
      header: t("people.table.employee"),
      cell: (info) => {
        const emp = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0 ${getAvatarColor(emp.role)}`}>
              {emp.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-merit-navy">{emp.name}</div>
              <div className="text-xs text-slate-500">{emp.email}</div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("departmentName", {
      header: t("people.table.department"),
      cell: (info) => info.getValue() || <span className="text-slate-400 italic">{t('people.table.unassigned')}</span>,
    }),
    columnHelper.accessor("role", {
      header: t("people.table.role"),
      cell: (info) => {
        const role = info.getValue();
        return (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(role)}`}>
            {ROLES[role]?.label || role}
          </span>
        );
      },
    }),
    columnHelper.accessor("salaryBandName", {
      header: t("people.table.band"),
      cell: (info) => {
        const emp = info.row.original;
        const bandName = info.getValue() || (emp.salaryBandId ? salaryBandNameById[emp.salaryBandId] : "");
        return bandName || <span className="text-slate-400 italic">-</span>;
      },
    }),
    columnHelper.accessor("status", {
      header: t("people.table.status"),
      cell: (info) => getStatusBadge(info.getValue()),
    }),
    columnHelper.accessor("createdAt", {
      header: t("people.table.joined"),
      cell: (info) => {
        const val = info.getValue();
        if (!val) return "-";
        const date = typeof val === 'number' ? new Date(val) : ('toDate' in val ? val.toDate() : new Date());
        return <span className="text-sm text-slate-600">{format(date, 'MMM d, yyyy')}</span>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: t("people.table.actions"),
      cell: (info) => (
        <button
          onClick={() => {
            const emp = info.row.original;
            setSelectedEmp(emp);
            setFormData({
              departmentId: emp.departmentId || "",
              salaryBandId: emp.salaryBandId || "",
              jobTitle: emp.jobTitle || "",
              role: emp.role,
            });
            setIsPanelOpen(true);
          }}
          className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors"
        >
          {t('people.table.view')}
        </button>
      ),
    }),
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  const clearFilters = () => {
    setGlobalFilter("");
    setDeptFilter("");
    setRoleFilter("");
    setStatusFilter("");
  };

  const handleSaveProfile = async () => {
    if (!selectedEmp) return;
    setIsSubmitting(true);
    try {
      // Handle standard profile updates
      await employeeService.updateEmployeeProfile({
        targetUid: selectedEmp.uid,
        departmentId: formData.departmentId || null,
        salaryBandId: formData.salaryBandId || null,
        jobTitle: formData.jobTitle,
      });

      // Handle role change separately if needed and allowed
      if (formData.role !== selectedEmp.role) {
          if (user?.role === 'super_admin') {
              await employeeService.changeEmployeeRole({
                  targetUid: selectedEmp.uid,
                  newRole: formData.role as RoleCode
              });
              toast.success("Profile and role updated successfully");
          } else {
              toast.error("Profile updated, but you don't have permission to change roles.");
          }
      } else {
          toast.success("Profile updated successfully");
      }
      setIsPanelOpen(false);
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (action: 'deactivate' | 'reactivate') => {
      if (!selectedEmp) return;
      try {
          if (action === 'deactivate') {
              await employeeService.deactivateEmployee(selectedEmp.uid);
              toast.success("Employee deactivated");
          } else {
              await employeeService.reactivateEmployee(selectedEmp.uid);
              toast.success("Employee reactivated");
          }
          setActionModal(null);
          // panel remains open, data updates via onSnapshot
      } catch (err) {
          const e = err as Error;
          toast.error(e.message || "An error occurred");
      }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-merit-navy">{t('people.title')}</h1>
        <p className="text-slate-500">{t('people.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500 mb-1">{t('people.stats.totalEmployees')}</p>
          <p className="text-2xl font-bold text-merit-navy">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500 mb-1">{t('people.stats.active')}</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500 mb-1">{t('people.stats.inactive')}</p>
          <p className="text-2xl font-bold text-red-600">{inactiveCount}</p>
        </div>
        <Link to="/hr/people/approvals" className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 block hover:border-amber-300 transition-colors">
          <p className="text-sm text-slate-500 mb-1 flex justify-between items-center">
            {t('people.stats.pending')} <ChevronRight className="w-4 h-4" />
          </p>
          <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('people.search.placeholder')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>

        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white min-w-[140px]"
          >
            <option value="">{t('people.search.allDepartments')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white min-w-[140px]"
          >
            <option value="">{t('people.search.allRoles')}</option>
            <option value="super_admin">{t('people.roles.super_admin')}</option>
            <option value="hr_admin">{t('people.roles.hr_admin')}</option>
            <option value="manager">{t('people.roles.manager')}</option>
            <option value="employee">{t('people.roles.employee')}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white min-w-[140px]"
          >
            <option value="">{t('people.search.allStatuses')}</option>
            <option value="active">{t('people.status.active')}</option>
            <option value="inactive">{t('people.status.inactive')}</option>
            <option value="pending">{t('people.status.pending')}</option>
          </select>

          <button
            onClick={clearFilters}
            className="p-2 border border-slate-300 text-slate-500 hover:bg-slate-50 rounded-lg flex-shrink-0"
            title={t('people.search.clearFilters')}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-6 py-4">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-lg font-medium text-slate-600">{t('people.table.noEmployeesFound')}</p>
                      <p className="text-sm">{t('people.table.adjustFilters')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-200 p-4 flex items-center justify-between bg-slate-50 mt-auto">
          <div className="text-sm text-slate-500">
            {t('people.table.pageOf', { page: table.getState().pagination.pageIndex + 1, total: table.getPageCount() || 1 })}
            {" "}{t('people.table.totalRows', { count: table.getFilteredRowModel().rows.length })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1 rounded border border-slate-300 bg-white disabled:opacity-50 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1 rounded border border-slate-300 bg-white disabled:opacity-50 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Panel */}
      <AnimatePresence>
        {isPanelOpen && selectedEmp && (
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
                <h2 className="text-xl font-bold text-merit-navy">{t('people.panel.title')}</h2>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center font-bold text-2xl ${getAvatarColor(selectedEmp.role)}`}>
                      {selectedEmp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-merit-navy">{selectedEmp.name}</h3>
                      <p className="text-slate-500 text-sm mb-2">{selectedEmp.email}</p>
                      <div className="flex gap-2">
                         <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(selectedEmp.role)}`}>
                           {ROLES[selectedEmp.role]?.label || selectedEmp.role}
                         </span>
                         {getStatusBadge(selectedEmp.status)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('people.panel.jobTitle')}</label>
                    <input
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('people.panel.department')}</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                    >
                      <option value="">{t('people.panel.noneAssigned')}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('people.panel.salaryBand')}</label>
                    <select
                      value={formData.salaryBandId}
                      onChange={(e) => setFormData({ ...formData, salaryBandId: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                    >
                      <option value="">{t('people.panel.noneAssigned')}</option>
                      {salaryBands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} (L{b.level})</option>
                      ))}
                    </select>
                  </div>

                  {isSuperAdmin && selectedEmp.uid !== user?.uid && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                         <ShieldAlert className="w-4 h-4 text-amber-500" />
                         {t('people.panel.systemRole')}
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as RoleCode })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white mb-2"
                      >
                        <option value="super_admin">{t('people.roles.super_admin')}</option>
                        <option value="hr_admin">{t('people.roles.hr_admin')}</option>
                        <option value="manager">{t('people.roles.manager')}</option>
                        <option value="employee">{t('people.roles.employee')}</option>
                      </select>
                      <p className="text-xs text-amber-600">{t('people.panel.roleChangeWarning')}</p>
                    </div>
                  )}

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('people.panel.saveChanges')}
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                {selectedEmp.uid !== user?.uid && selectedEmp.status !== "pending" && (
                    <div className="mt-4 mx-6 mb-6">
                        <div className="border border-red-200 rounded-lg overflow-hidden">
                            <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                                <h4 className="font-bold text-red-800 text-sm">{t('people.panel.dangerZone')}</h4>
                            </div>
                            <div className="p-4 bg-white flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">
                                        {selectedEmp.status === 'active' ? t('people.panel.deactivateAccount') : t('people.panel.reactivateAccount')}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                                        {selectedEmp.status === 'active'
                                            ? t('people.panel.deactivateDescription')
                                            : t('people.panel.reactivateDescription')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActionModal(selectedEmp.status === 'active' ? 'deactivate' : 'reactivate')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border flex items-center gap-2 ${
                                        selectedEmp.status === 'active'
                                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                                        : 'border-green-200 text-green-600 hover:bg-green-50'
                                    }`}
                                >
                                    {selectedEmp.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                    {selectedEmp.status === 'active' ? t('people.panel.deactivate') : t('people.panel.reactivate')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Action Confirmation Modal */}
      {actionModal && selectedEmp && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setActionModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-merit-navy mb-4">
                {actionModal === 'deactivate' ? t('people.modal.deactivateTitle') : t('people.modal.reactivateTitle')}
            </h3>
            <p className="text-slate-600 mb-6"
              dangerouslySetInnerHTML={{
                __html: actionModal === 'deactivate'
                  ? t('people.modal.deactivateConfirm', { name: selectedEmp.name })
                  : t('people.modal.reactivateConfirm', { name: selectedEmp.name })
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
              >
                {t('people.modal.cancel')}
              </button>
              <button
                onClick={() => handleStatusChange(actionModal)}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${
                    actionModal === 'deactivate' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {actionModal === 'deactivate' ? t('people.modal.confirmDeactivate') : t('people.modal.confirmReactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
