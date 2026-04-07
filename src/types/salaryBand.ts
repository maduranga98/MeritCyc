import { Timestamp } from 'firebase/firestore';

export interface SalaryBand {
  id: string;
  name: string;
  level: number;
  minSalary: number;
  maxSalary: number;
  currency: string;
  employeeCount?: number;
  createdAt: Timestamp;
}