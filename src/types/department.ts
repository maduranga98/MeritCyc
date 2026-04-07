import { Timestamp } from 'firebase/firestore';

export interface Department {
  id: string;
  name: string;
  managerId?: string;
  managerName?: string;
  employeeCount: number;
  createdAt: Timestamp;
  createdBy: string;
}