export interface Invite {
  id: string;
  email: string;
  name: string;
  departmentId: string;
  salaryBandId: string;
  role: 'employee' | 'manager';
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  resendCount: number;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
  companyId: string;
}
