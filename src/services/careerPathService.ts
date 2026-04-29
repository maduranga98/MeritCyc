import { db } from '../config/firebase';
import { collection, doc, getDocs, onSnapshot, query, where, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { type CareerPath, type CareerProgressResult } from '../types/careerPath';

export const getCompanyCareerPaths = async (companyId: string): Promise<CareerPath[]> => {
  const snap = await getDocs(query(collection(db, 'careerPaths'), where('companyId', '==', companyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CareerPath));
};

export const saveCareerPath = async (careerPath: CareerPath): Promise<void> => {
  await setDoc(doc(db, 'careerPaths', careerPath.id), careerPath, { merge: true });
};

export const watchCareerProgress = (uid: string, cb: (data: CareerProgressResult | null) => void) =>
  onSnapshot(doc(db, 'users', uid, 'careerProgress', 'current'), (snap) => {
    cb(snap.exists() ? (snap.data() as CareerProgressResult) : null);
  });

export const getCareerPathCallable = async (userId: string) => {
  const fn = httpsCallable(getFunctions(), 'getCareerPath');
  const res = await fn({ userId });
  return res.data;
};

export const calculateProgressCallable = async (userId: string, cycleId: string) => {
  const fn = httpsCallable(getFunctions(), 'calculateProgress');
  const res = await fn({ userId, cycleId });
  return res.data;
};
