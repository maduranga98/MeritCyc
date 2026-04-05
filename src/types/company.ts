export interface Company {
  id: string;
  name: string;
  email: string;
  address?: string;
  mobileNumber?: string;
  adminUid: string;
  status: 'active' | 'inactive';
  createdAt: number; // or Date, depending on how we handle Firestore Timestamps
}
