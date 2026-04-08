import { db } from '../config/firebase';
import { collection, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { type IncrementStory, type CareerMap } from '../types/incrementStory';

export const getIncrementStories = (uid: string, callback: (stories: IncrementStory[]) => void) => {
  const q = collection(db, 'users', uid, 'incrementStories');
  return onSnapshot(q, (snapshot) => {
    const stories = snapshot.docs.map(doc => ({ ...doc.data() } as IncrementStory));
    // Sort descending by completedAt
    stories.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
    callback(stories);
  });
};

export const getIncrementStory = async (uid: string, cycleId: string): Promise<IncrementStory | null> => {
  const docRef = doc(db, 'users', uid, 'incrementStories', cycleId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data() as IncrementStory;
  }
  return null;
};

export const getCareerMap = (uid: string, callback: (map: CareerMap | null) => void) => {
  const docRef = doc(db, 'users', uid, 'careerMap', 'current');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as CareerMap);
    } else {
      callback(null);
    }
  });
};
