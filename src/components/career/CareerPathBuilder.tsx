import React from 'react';
import { type CareerPath } from '../../types/careerPath';

export const CareerPathBuilder: React.FC<{ companyId: string; onSave: (cp: CareerPath) => Promise<void> }> = ({ companyId, onSave }) => {
  const role = 'Software Engineer';

  const save = async () => {
    await onSave({
      id: `${companyId}-${role.toLowerCase().replace(/\s+/g, '-')}`,
      companyId,
      name: `${role} Track`,
      description: 'Starter career path for software engineers.',
      levels: [
        {
          levelId: crypto.randomUUID(),
          levelNumber: 1,
          title: 'L1',
          salaryBandId: '',
          salaryBandName: '',
          requiredScore: 75,
          requiredCycles: 2,
          description: 'Entry-level software engineer.',
          milestones: [],
        },
      ],
      createdBy: '',
      createdAt: new Date() as unknown as import('firebase/firestore').Timestamp,
      updatedAt: new Date() as unknown as import('firebase/firestore').Timestamp,
      isActive: true,
    });
  };

  return <button onClick={save} className="px-4 py-2 rounded-lg bg-merit-navy text-white text-sm font-semibold">Create Starter Career Path</button>;
};
