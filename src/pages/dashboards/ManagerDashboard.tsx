import React from 'react';
import { useAuth } from '../../context/AuthContext';

const ManagerDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="p-8 font-brand">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-merit-navy">Manager Dashboard</h1>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
      </div>
      <p>Welcome, {user?.name}!</p>
      <div className="mt-6 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Actions</h2>
        <ul className="list-disc pl-5">
          <li>Review team performance</li>
          <li>Recommend increments</li>
        </ul>
      </div>
    </div>
  );
};

export default ManagerDashboard;
