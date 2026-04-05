import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

const SuperAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ email: string } | null>(null);

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);
    setIsLoading(true);

    try {
      const createAdminUser = httpsCallable(functions, 'createAdminUser');

      await createAdminUser({
        email: adminEmail,
        password: adminPassword,
        name: adminName,
        companyName: companyName,
        address: companyAddress,
        mobileNumber: mobileNumber,
      });

      setSuccessData({
        email: adminEmail,
      });

      // Clear form
      setCompanyName('');
      setCompanyAddress('');
      setMobileNumber('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
    } catch (err: unknown) {
      console.error("Error creating company admin:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred while creating the company admin.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 font-brand max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold text-merit-navy">Super Admin Dashboard</h1>
        <button onClick={logout} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition">Logout</button>
      </div>

      <div className="mb-8">
        <p className="text-lg text-merit-slate">Welcome back, <span className="font-semibold text-merit-navy">{user?.name}</span></p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-merit-navy mb-6">Register New Company</h2>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {successData && (
          <div className="mb-6 bg-green-50 text-green-800 p-6 rounded-xl border border-green-200">
            <h3 className="font-bold text-lg mb-2">Company and Admin Registered Successfully!</h3>
            <p className="mb-4">The company admin can now login using their email address.</p>
            <div className="bg-white p-4 rounded bg-opacity-60 font-mono text-sm border border-green-100">
              <p><strong>Admin Email:</strong> {successData.email}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleRegisterCompany} className="space-y-6 max-w-xl">
          <div>
            <label className="block text-sm font-bold uppercase text-merit-slate mb-2">Company Name</label>
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
            <label className="block text-sm font-bold uppercase text-merit-slate mb-2">Company Address</label>
            <input
              type="text"
              required
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
              placeholder="123 Main St, City, Country"
            />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase text-merit-slate mb-2">Mobile Number</label>
            <input
              type="tel"
              required
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all"
              placeholder="+1 234 567 8900"
            />
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-merit-navy mb-4">Admin Credentials</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold uppercase text-merit-slate mb-2">Admin Full Name</label>
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
                  <label className="block text-sm font-bold uppercase text-merit-slate mb-2">Admin Email</label>
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
                  <label className="block text-sm font-bold uppercase text-merit-slate mb-2">Admin Password</label>
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

          <button
            type="submit"
            disabled={isLoading}
            className="bg-merit-emerald text-white font-bold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-merit-emerald/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : 'Register Company & Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
