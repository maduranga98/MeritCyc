import { Timestamp } from 'firebase/firestore';

export interface SalaryBand {
  id: string;
  name: string;
  level: number;
  minSalary: number;
  maxSalary: number;
  // Legacy field names written by the company seed (createCompany). Kept
  // optional so older/seeded bands still resolve a range in the UI.
  min?: number;
  max?: number;
  currency: string;
  employeeCount?: number;
  createdAt: Timestamp;
}