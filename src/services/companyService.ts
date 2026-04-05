import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type Company } from '../types/company';

export const companyService = {
  getCompanies: async (): Promise<Company[]> => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name,
        email: data.email,
        address: data.address,
        mobileNumber: data.mobileNumber,
        adminUid: data.adminUid,
        status: data.status || 'active',
        // Convert Firestore Timestamp to milliseconds
        createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now(),
      } as Company;
    });
  },

  toggleCompanyStatus: async (id: string, currentStatus: 'active' | 'inactive'): Promise<void> => {
    const companyRef = doc(db, 'companies', id);
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateDoc(companyRef, {
      status: newStatus
    });
  },

  deleteCompany: async (id: string): Promise<void> => {
    const companyRef = doc(db, 'companies', id);
    await deleteDoc(companyRef);
    // Note: This only deletes the company document. Deleting the associated
    // Auth user requires a Cloud Function as client-side SDKs cannot delete other users.
  }
};
