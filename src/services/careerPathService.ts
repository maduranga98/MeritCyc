import { db, functions } from '../config/firebase';
import { collection, doc, onSnapshot, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { type CareerPath, type EmployeeCareerMap } from '../types/careerPath';

// ---------------------------------------------------------------------------
// Career Paths (HR side)
// ---------------------------------------------------------------------------

export const getCompanyCareerPaths = (companyId: string, callback: (paths: CareerPath[]) => void) => {
  const q = query(collection(db, 'companies', companyId, 'careerPaths'));
  return onSnapshot(q, (snapshot) => {
    const paths = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CareerPath));
    callback(paths);
  });
};

export const createCareerPath = async (data: Omit<CareerPath, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<{ success: boolean; pathId: string }> => {
  const fn = httpsCallable(functions, 'createCareerPath');
  const res = await fn(data);
  return res.data as { success: boolean; pathId: string };
};

export const updateCareerPath = async (pathId: string, data: Omit<CareerPath, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<{ success: boolean }> => {
  const fn = httpsCallable(functions, 'updateCareerPath');
  const res = await fn({ pathId, ...data });
  return res.data as { success: boolean };
};

// ---------------------------------------------------------------------------
// Employee Career Map
// ---------------------------------------------------------------------------

export const getEmployeeCareerMap = (
  uid: string,
  callback: (map: EmployeeCareerMap | null) => void,
  onError?: (error: Error) => void
) => {
  const docRef = doc(db, 'users', uid, 'careerMap', 'current');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as EmployeeCareerMap);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('[getEmployeeCareerMap] onSnapshot error:', error);
      onError?.(error);
    }
  );
};

export const getCareerMapWithPath = async (targetUserId: string): Promise<{ careerMap: EmployeeCareerMap | null; careerPath: CareerPath | null }> => {
  const fn = httpsCallable(functions, 'getCareerMapForEmployee');
  const res = await fn({ targetUserId });
  const data = (res.data as { success: boolean; data: { careerMap: EmployeeCareerMap | null; careerPath: CareerPath | null } }).data;
  return data;
};

export const assignCareerPath = async (targetUserId: string, careerPathId: string, startingLevelId?: string): Promise<{ success: boolean }> => {
  const fn = httpsCallable(functions, 'assignCareerPath');
  const res = await fn({ targetUserId, careerPathId, startingLevelId });
  return res.data as { success: boolean };
};

export const approvePromotion = async (targetUserId: string, newLevelId: string): Promise<{ success: boolean }> => {
  const fn = httpsCallable(functions, 'approvePromotion');
  const res = await fn({ targetUserId, newLevelId });
  return res.data as { success: boolean };
};

// ---------------------------------------------------------------------------
// Evaluations & Cycles (for employee career page)
// ---------------------------------------------------------------------------

export const getEmployeeEvaluations = async (uid: string, companyId: string, maxCount = 5) => {
  const q = query(
    collection(db, 'evaluations'),
    where('employeeUid', '==', uid),
    where('companyId', '==', companyId),
    where('status', '==', 'finalized'),
    orderBy('finalizedAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getActiveCycle = async (companyId: string) => {
  const q = query(
    collection(db, 'cycles'),
    where('companyId', '==', companyId),
    where('status', '==', 'active'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const getIncrementStoryRecommendations = async (uid: string) => {
  const storiesRef = collection(db, 'users', uid, 'incrementStories');
  const snap = await getDocs(storiesRef);
  if (snap.empty) return null;
  const stories = snap.docs.map((d) => d.data());
  stories.sort((a, b) => {
    const aTime = a.completedAt?.toMillis?.() || 0;
    const bTime = b.completedAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return stories[0]?.recommendations || null;
};
