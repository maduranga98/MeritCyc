import React from 'react';
import { type CareerPath } from '../../types/careerPath';

export const CareerPathBuilder: React.FC<{ companyId: string; onSave: (cp: CareerPath) => Promise<void> }> = ({ companyId, onSave }) => {
  const role = 'Software Engineer';

  const save = async () => {
    await onSave({
      id: `${companyId}-${role.toLowerCase().replace(/\s+/g, '-')}`,
      companyId,
      role,
      levels: [
        { level: 'L1', nextLevel: 'L2', criteria: [{ name: 'Performance', weight: 0.5, threshold: 75 }, { name: 'Collaboration', weight: 0.5, threshold: 70 }] },
      ],
    });
  };

  return <button onClick={save} className="px-4 py-2 rounded-lg bg-merit-navy text-white text-sm font-semibold">Create Starter Career Path</button>;
};
