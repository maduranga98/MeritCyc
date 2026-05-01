import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { employeeService } from "../../services/employeeService";
import { type Employee } from "../../types/employee";
import { type DepartmentPerformance } from "../../types/analytics";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  Award,
  Loader2,
  Building2,
  Mail,
  Briefcase,
} from "lucide-react";

export default function DepartmentAnalyticsDetail() {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deptInfo] = useState<DepartmentPerformance | null>(
    location.state?.deptInfo || null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.companyId && deptId) {
      fetchData();
    }
  }, [user, deptId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const allEmployees = await employeeService.getEmployees(user!.companyId);
      const deptEmployees = allEmployees.filter(
        (e) => e.departmentId === deptId
      );
      setEmployees(deptEmployees);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header with back button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/analytics")}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {deptInfo?.departmentName || "Department"}
            </h1>
            <p className="text-sm text-slate-500">Detailed Analytics View</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
          <Building2 className="w-4 h-4" />
          <span>ID: {deptId}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <Users className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Employees</p>
            <h3 className="text-2xl font-bold text-slate-900">{employees.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <Award className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Average Score</p>
            <h3 className="text-2xl font-bold text-emerald-600">
              {deptInfo?.averageScore ?? "N/A"}/100
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Average Increment</p>
            <h3 className="text-2xl font-bold text-blue-600">
              {deptInfo?.averageIncrement ?? "N/A"}%
            </h3>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Department Employees
        </h2>
        {employees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No employees found in this department.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Employee</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        {emp.jobTitle || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {emp.role.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {emp.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          emp.status === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : emp.status === "pending"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
