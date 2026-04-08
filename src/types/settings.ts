export interface CompanySettings {
  name: string;
  logoUrl?: string;
  timezone: string;
  currency: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  address?: string;
  mobileNumber?: string;
  industry?: string;
  size?: string;
}

export interface NotificationSettings {
  pendingApprovalThresholdHours: number;
  pendingApprovalReminderFrequencyHours: number;
  budgetWarningThreshold: number;
  budgetCriticalThreshold: number;
  evaluationReminderDays: number[];
  reminderRecipient: 'manager' | 'manager_hr' | 'all';
  emailEventsEnabled: Record<string, boolean>;
}

export interface SecuritySettings {
  idleTimeoutMinutes: number;
  passwordMinLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}
