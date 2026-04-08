// =============================================================================
// Evaluation Service — Module 5: Evaluation & Scoring
// READ: direct Firestore (onSnapshot for real-time)
// WRITE: via Cloud Functions only
// =============================================================================

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { type Evaluation, type CriteriaScore } from '../types/evaluation';

// ---------------------------------------------------------------------------
// Helper: map Firestore doc → Evaluation type
// ---------------------------------------------------------------------------

function mapDocToEvaluation(docId: string, data: Record<string, unknown>): Evaluation {
  return {
    id: docId,
    companyId: (data.companyId as string) ?? '',
    cycleId: (data.cycleId as string) ?? '',
    employeeUid: (data.employeeUid as string) ?? '',
    employeeName: (data.employeeName as string) ?? '',
    employeeEmail: (data.employeeEmail as string) ?? '',
    departmentId: (data.departmentId as string) ?? '',
    salaryBandId: data.salaryBandId as string | undefined,
    currentSalary: data.currentSalary as number | undefined,
    managerId: (data.managerId as string) ?? '',
    managerName: (data.managerName as string) ?? '',
    scores: (data.scores as Record<string, CriteriaScore>) ?? {},
    weightedTotalScore: (data.weightedTotalScore as number) ?? 0,
    assignedTierId: data.assignedTierId as string | undefined,
    assignedTierName: data.assignedTierName as string | undefined,
    incrementPercent: data.incrementPercent as number | undefined,
    incrementAmount: data.incrementAmount as number | undefined,
    status: (data.status as Evaluation['status']) ?? 'not_started',
    overrideReason: data.overrideReason as string | undefined,
    overriddenBy: data.overriddenBy as string | undefined,
    overriddenAt: data.overriddenAt as Evaluation['overriddenAt'],
    submittedAt: data.submittedAt as Evaluation['submittedAt'],
    finalizedAt: data.finalizedAt as Evaluation['finalizedAt'],
    createdAt: data.createdAt as Evaluation['createdAt'],
    updatedAt: data.updatedAt as Evaluation['updatedAt'],
  };
}

// ---------------------------------------------------------------------------
// READ operations (direct Firestore — real-time)
// ---------------------------------------------------------------------------

export const evaluationService = {
  /** Subscribe to all evaluations for a manager in a specific cycle */
  getManagerEvaluations: (
    managerId: string,
    cycleId?: string,
    callback?: (evaluations: Evaluation[]) => void
  ): (() => void) => {
    let q = query(
      collection(db, 'evaluations'),
      where('managerId', '==', managerId)
    );
    if (cycleId) {
       q = query(q, where('cycleId', '==', cycleId));
    }

    // We cannot reliably sort by updatedAt without an index if we have multiple wheres.
    // Assuming simple query for now.

    return onSnapshot(q, (snapshot) => {
      const evaluations = snapshot.docs.map((d) =>
        mapDocToEvaluation(d.id, d.data() as Record<string, unknown>)
      );
      if (callback) callback(evaluations);
    });
  },

  /** Subscribe to all evaluations for a specific cycle (for HR use) */
  getCycleEvaluations: (
    cycleId: string,
    callback: (evaluations: Evaluation[]) => void
  ): (() => void) => {
    const q = query(
      collection(db, 'evaluations'),
      where('cycleId', '==', cycleId)
    );
    return onSnapshot(q, (snapshot) => {
      const evaluations = snapshot.docs.map((d) =>
        mapDocToEvaluation(d.id, d.data() as Record<string, unknown>)
      );
      callback(evaluations);
    });
  },

  /** Fetch a single evaluation document */
  getEvaluation: async (evaluationId: string): Promise<Evaluation | null> => {
    const docRef = doc(db, 'evaluations', evaluationId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return mapDocToEvaluation(docSnap.id, docSnap.data() as Record<string, unknown>);
    }
    return null;
  },

  // -------------------------------------------------------------------------
  // WRITE operations (via Cloud Functions — blueprint rule #1)
  // -------------------------------------------------------------------------

  initializeEvaluations: async (cycleId: string): Promise<{ success: boolean; evaluationCount: number }> => {
    const fn = httpsCallable<{ cycleId: string }, { success: boolean; evaluationCount: number }>(
      functions,
      'initializeCycleEvaluations'
    );
    const result = await fn({ cycleId });
    return result.data;
  },

  saveDraft: async (
    evaluationId: string,
    scores: Record<string, CriteriaScore>
  ): Promise<{ success: boolean; weightedTotalScore: number; assignedTierId?: string }> => {
    const fn = httpsCallable<{ evaluationId: string; scores: Record<string, CriteriaScore> }, { success: boolean; weightedTotalScore: number; assignedTierId?: string }>(
      functions,
      'saveDraftEvaluation'
    );
    const result = await fn({ evaluationId, scores });
    return result.data;
  },

  submitEvaluation: async (
    evaluationId: string,
    scores: Record<string, CriteriaScore>
  ): Promise<{ success: boolean }> => {
    const fn = httpsCallable<{ evaluationId: string; scores: Record<string, CriteriaScore> }, { success: boolean }>(
      functions,
      'submitEvaluation'
    );
    const result = await fn({ evaluationId, scores });
    return result.data;
  },

  overrideScore: async (
    evaluationId: string,
    scores: Record<string, CriteriaScore>,
    reason: string
  ): Promise<{ success: boolean }> => {
    const fn = httpsCallable<{ evaluationId: string; scores: Record<string, CriteriaScore>; reason: string }, { success: boolean }>(
      functions,
      'overrideScore'
    );
    const result = await fn({ evaluationId, scores, reason });
    return result.data;
  },

  finalizeCycle: async (cycleId: string): Promise<{ success: boolean; totalIncrementsProcessed: number }> => {
    const fn = httpsCallable<{ cycleId: string }, { success: boolean; totalIncrementsProcessed: number }>(
      functions,
      'finalizeCycle'
    );
    const result = await fn({ cycleId });
    return result.data;
  },

  requestEvaluationDeadlineReminder: async (cycleId: string): Promise<{ success: boolean }> => {
    const fn = httpsCallable<{ cycleId: string }, { success: boolean }>(
      functions,
      'requestEvaluationDeadlineReminder'
    );
    const result = await fn({ cycleId });
    return result.data;
  }
};
