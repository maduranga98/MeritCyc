import { type Timestamp } from 'firebase/firestore';

export type PendingStatus =
  'otp_pending' | 'pending_approval' | 'approved' | 'rejected' | 'info_requested';

export interface PendingRegistration {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyCode: string;
  departmentId: string;
  jobTitle: string;
  status: PendingStatus;
  otpAttempts?: number;
  otpExpiresAt?: number;
  cooldownUntil?: number | null;
  createdAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedReason?: string;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  infoRequestedMessage?: string;
}
