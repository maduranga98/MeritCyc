import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { companyService } from "../../services/companyService";
import { type Company } from "../../types/company";

const PlatformDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  // Registration form state
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ email: string } | null>(
    null,
  );

  // Companies list state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const data = await companyService.getCompanies();
      setCompanies(data);
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    fetchCompanies().catch(console.error);
  }, []);

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);
    setIsSubmitting(true);

    try {
      // Calls Cloud Function — no direct Firestore write
      await companyService.createCompany({
        companyName,
        address: companyAddress,
        mobileNumber,
        adminName,
        adminEmail,
        adminPassword,
      });

      setSuccessData({ email: adminEmail });

      // Clear form
      setCompanyName("");
      setCompanyAddress("");
      setMobileNumber("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");

      // Refresh list
      await fetchCompanies();
    } catch (err: unknown) {
      console.error("Error creating company:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while creating the company.",
      );
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
    if (
      !window.confirm(
        "Are you sure? The company will be scheduled for deletion with a 30-day grace period.",
      )
    ) {
      return;
    }
    try {
      await companyService.deleteCompany(id);
      await fetchCompanies();
    } catch (err) {
      console.error("Error deleting company:", err);
      setError("Failed to delete company.");
    }
  };

  return (
    <div className="p-8 font-brand max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-merit-navy">
            Platform Dashboard
          </h1>
          <p className="text-xs text-merit-slate mt-1 uppercase tracking-wider">
            Lumora Ventures — Platform Management
          </p>
        </div>
        <button
          onClick={logout}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition"
        >
          Logout
        </button>
      </div>

      <div className="mb-8">
        <p className="text-lg text-merit-slate">
          Welcome back,{" "}
          <span className="font-semibold text-merit-navy">{user?.name}</span>
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-medium">
          {error}
        </div>
      )}

      {/* Registration Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-2xl font-bold text-merit-navy mb-6">
          Register New Company
        </h2>

        {successData && (
          <div className="mb-6 bg-green-50 text-green-800 p-6 rounded-xl border border-green-200">
            <h3 className="font-bold text-lg mb-2">
              Company Registered Successfully!
            </h3>
            <p className="mb-4">
              The company Super Admin can now login with their email.
            </p>
            <div className="bg-white p-4 rounded bg-opacity-60 font-mono text-sm border border-green-100">
              <p>
                <strong>Admin Email:</strong> {successData.email}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleRegisterCompany} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold uppercase text-merit-slate mb-2">
                Company Name
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-bold uppercase text-merit-slate mb-2">
                Mobile Number
              </label>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
                placeholder="+94 77 123 4567"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold uppercase text-merit-slate mb-2">
              Company Address
            </label>
            <input
              type="text"
              required
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
              placeholder="123 Main St, Colombo, Sri Lanka"
            />
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-merit-navy mb-4">
              Company Super Admin Credentials
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold uppercase text-merit-slate mb-2">
                  Admin Full Name
                </label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold uppercase text-merit-slate mb-2">
                    Admin Email
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
                    placeholder="jane@acmecorp.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold uppercase text-merit-slate mb-2">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
                    placeholder="Secure password"
                    minLength={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-merit-emerald text-white font-bold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-merit-emerald/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Registering..." : "Register Company & Admin"}
            </button>
          </div>
        </form>
      </div>

      {/* Companies List */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-merit-navy mb-6">
          Registered Companies
        </h2>

        {loadingCompanies ? (
          <p className="text-merit-slate">Loading companies...</p>
        ) : companies.length === 0 ? (
          <p className="text-gray-500 italic">No companies registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-merit-slate uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-merit-slate uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-merit-slate uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-merit-slate uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-merit-slate uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-merit-slate uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-merit-navy">
                        {company.name}
                      </div>
                      <div className="text-xs text-merit-slate mt-1">
                        {company.address || "No address"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {company.email || "No email"}
                      </div>
                      <div className="text-xs text-merit-slate mt-1">
                        {company.mobileNumber || "No mobile"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {company.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                          company.status === "active"
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : company.status === "suspended"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {company.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(company.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {company.status !== "suspended" && (
                        <button
                          onClick={() =>
                            handleToggleStatus(
                              company.id,
                              company.status as "active" | "inactive",
                            )
                          }
                          className={`${
                            company.status === "active"
                              ? "text-orange-600 hover:text-orange-900"
                              : "text-green-600 hover:text-green-900"
                          } font-semibold`}
                        >
                          {company.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      )}
                      {company.status !== "suspended" && (
                        <button
                          onClick={() => handleDeleteCompany(company.id)}
                          className="text-red-600 hover:text-red-900 font-semibold"
                        >
                          Delete
                        </button>
                      )}
                      {company.status === "suspended" && (
                        <span className="text-amber-600 text-xs">
                          Deletion pending
                        </span>
                      )}
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

export default PlatformDashboard;
