import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type Company, type NewCompany } from '../types/company';

const COMPANIES_COLLECTION = 'companies';

export const companyService = {
  async addCompany(company: NewCompany): Promise<Company> {
    const newCompanyData = {
      ...company,
      status: 'active',
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, COMPANIES_COLLECTION), newCompanyData);

    return {
      id: docRef.id,
      ...newCompanyData,
    } as Company;
  },

  async getCompanies(): Promise<Company[]> {
    const querySnapshot = await getDocs(collection(db, COMPANIES_COLLECTION));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Company[];
  },

  async deleteCompany(id: string): Promise<void> {
    await deleteDoc(doc(db, COMPANIES_COLLECTION, id));
  },

  async toggleCompanyStatus(id: string, currentStatus: 'active' | 'inactive'): Promise<void> {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, COMPANIES_COLLECTION, id), {
      status: newStatus,
    });
  }
};
