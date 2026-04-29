import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CareerPathBuilder } from '../../components/career/CareerPathBuilder';
import { saveCareerPath } from '../../services/careerPathService';

const CareerPathManagement: React.FC = () => {
  const { user } = useAuth();

  if (!user?.companyId) {
    return <div className="text-sm text-slate-500">Company context is required.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 font-brand">
      <h1 className="text-2xl font-bold text-slate-900">Career Path Management</h1>
      <p className="text-sm text-slate-500">Define progression levels and criteria used to determine employee advancement.</p>
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <CareerPathBuilder companyId={user.companyId} onSave={saveCareerPath} />
      </div>
    </div>
  );
};

export default CareerPathManagement;
