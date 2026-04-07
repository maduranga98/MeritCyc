import { Timestamp } from 'firebase/firestore';
import { type RoleCode } from './roles';

export interface Employee {
  uid: string;
  name: string;
  email: string;
  role: RoleCode;
  companyId: string;
  departmentId?: string;
  departmentName?: string;
  salaryBandId?: string;
  salaryBandName?: string;
  jobTitle?: string;
  status: 'active' | 'inactive' | 'pending';
  approved: boolean;
  photoURL?: string;
  createdAt: Timestamp;
}