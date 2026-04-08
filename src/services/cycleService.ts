// =============================================================================
// Cycle Service — Module 3: Increment Cycle Engine
// READ: direct Firestore (onSnapshot for real-time)
// WRITE: via Cloud Functions only
// =============================================================================

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { type Cycle, type CriteriaItem, type TierConfig } from '../types/cycle';

// ---------------------------------------------------------------------------
// Helper: map Firestore doc → Cycle type
// ---------------------------------------------------------------------------

function mapDocToCycle(docId: string, data: Record<string, unknown>): Cycle {
  return {
    id: docId,
    companyId: (data.companyId as string) ?? '',
    name: (data.name as string) ?? '',
    description: data.description as string | undefined,
    status: (data.status as Cycle['status']) ?? 'draft',
    scope: (data.scope as Cycle['scope']) ?? {
      departmentIds: [],
      salaryBandIds: [],
      allEmployees: true,
    },
    budget: (data.budget as Cycle['budget']) ?? {
      type: 'percentage',
      currency: 'USD',
    },
    criteria: (data.criteria as CriteriaItem[]) ?? [],
    tiers: (data.tiers as TierConfig[]) ?? [],
    timeline: data.timeline as Cycle['timeline'],
    lockedAt: data.lockedAt as Cycle['lockedAt'],
    lockedBy: data.lockedBy as string | undefined,
    createdAt: data.createdAt as Cycle['createdAt'],
    createdBy: (data.createdBy as string) ?? '',
    updatedAt: data.updatedAt as Cycle['updatedAt'],
    employeeCount: (data.employeeCount as number) ?? 0,
    totalWeight: (data.totalWeight as number) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// READ operations (direct Firestore — real-time)
// ---------------------------------------------------------------------------

export const cycleService = {
  /** Subscribe to all cycles for a company — real-time */
  subscribeToCycles: (
    companyId: string,
    callback: (cycles: Cycle[]) => void
  ): (() => void) => {
    const q = query(
      collection(db, 'cycles'),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const cycles = snapshot.docs.map((d) =>
        mapDocToCycle(d.id, d.data() as Record<string, unknown>)
      );
      callback(cycles);
    });
  },

  /** Subscribe to a single cycle — real-time */
  subscribeToCycle: (
    cycleId: string,
    callback: (cycle: Cycle | null) => void
  ): (() => void) => {
    return onSnapshot(doc(db, 'cycles', cycleId), (d) => {
      if (!d.exists()) {
        callback(null);
        return;
      }
      callback(mapDocToCycle(d.id, d.data() as Record<string, unknown>));
    });
  },

  // -------------------------------------------------------------------------
  // WRITE operations (via Cloud Functions — blueprint rule #1)
  // -------------------------------------------------------------------------

  createCycle: async (data: {
    name: string;
    description?: string;
    scope: Cycle['scope'];
    budget: Cycle['budget'];
    timeline: { startDate: string; endDate: string; evaluationDeadline: string };
  }): Promise<{ success: boolean; cycleId: string }> => {
    const fn = httpsCallable<typeof data, { success: boolean; cycleId: string }>(
      functions,
      'createCycle'
    );
    const result = await fn(data);
    return result.data;
  },

  updateCycle: async (data: {
    cycleId: string;
    name?: string;
    description?: string;
    scope?: Cycle['scope'];
    budget?: Cycle['budget'];
    timeline?: { startDate: string; endDate: string; evaluationDeadline: string };
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'updateCycle'
    );
    const result = await fn(data);
    return result.data;
  },

  updateCycleCriteria: async (data: {
    cycleId: string;
    criteria: CriteriaItem[];
    tiers: TierConfig[];
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'updateCycleCriteria'
    );
    const result = await fn(data);
    return result.data;
  },

  publishAndLockCycle: async (data: {
    cycleId: string;
    confirmationCode: string;
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'publishAndLockCycle'
    );
    const result = await fn(data);
    return result.data;
  },

  cancelCycle: async (data: {
    cycleId: string;
    reason: string;
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'cancelCycle'
    );
    const result = await fn(data);
    return result.data;
  },
};
