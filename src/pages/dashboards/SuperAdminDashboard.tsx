import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { companyService } from "../../services/companyService";
import { type Company } from "../../types/company";

const SuperAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await companyService.getCompanies();
      setCompanies(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError("Failed to fetch companies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies().catch(console.error);
  }, []);

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newCompanyEmail) return;

    try {
      setIsSubmitting(true);
      await companyService.addCompany({
        name: newCompanyName,
        email: newCompanyEmail,
      });
      setNewCompanyName("");
      setNewCompanyEmail("");
      await fetchCompanies();
    } catch (err) {
      console.error("Error registering company:", err);
      setError("Failed to register company.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (
    id: string,
    currentStatus: "active" | "inactive",
  ) => {
    try {
      await companyService.toggleCompanyStatus(id, currentStatus);
      await fetchCompanies();
    } catch (err) {
      console.error("Error toggling status:", err);
      setError("Failed to update company status.");
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this company?"))
      return;
    try {
      await companyService.deleteCompany(id);
      await fetchCompanies();
    } catch (err) {
      console.error("Error deleting company:", err);
      setError("Failed to delete company.");
    }
  };

  return (
    <div className="p-8 font-brand max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold text-merit-navy">
          Super Admin Dashboard
        </h1>
        <button
          onClick={logout}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition"
        >
          Logout
        </button>
      </div>
      <p>Welcome, {user?.name}!</p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      <div className="mt-6 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Register New Company</h2>
        <form onSubmit={handleRegisterCompany} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
                className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-merit-emerald/50"
                placeholder="Company Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                value={newCompanyEmail}
                onChange={(e) => setNewCompanyEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-merit-emerald/50"
                placeholder="admin@company.com"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-merit-navy text-white px-6 py-2 rounded hover:bg-merit-navy/90 disabled:opacity-70 transition-colors"
          >
            {isSubmitting ? "Registering..." : "Register Company"}
          </button>
        </form>
      </div>

      <div className="mt-8 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Registered Companies</h2>
        {loading ? (
          <p>Loading companies...</p>
        ) : companies.length === 0 ? (
          <p className="text-gray-500">No companies registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {company.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {company.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${company.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(company.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() =>
                          handleToggleStatus(company.id, company.status)
                        }
                        className={`text-white px-3 py-1 rounded text-xs ${company.status === "active" ? "bg-orange-500 hover:bg-orange-600" : "bg-green-500 hover:bg-green-600"}`}
                      >
                        {company.status === "active"
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(company.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                      >
                        Delete
                      </button>
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
};

export default SuperAdminDashboard;
