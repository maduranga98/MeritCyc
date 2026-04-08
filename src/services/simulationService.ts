// =============================================================================
// Simulation & Budget Service — Module 4
// =============================================================================

import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions, rtdb } from '../config/firebase';
import { type Simulation, type SimulationParameters } from '../types/simulation';
import { type BudgetTracking } from '../types/budgetTracking';

export const simulationService = {
  // ---------------------------------------------------------------------------
  // READ operations
  // ---------------------------------------------------------------------------

  /** Subscribe to all simulations for a cycle — real-time */
  getSimulations: (cycleId: string, callback: (simulations: Simulation[]) => void): (() => void) => {
    const q = query(
      collection(db, `cycles/${cycleId}/simulations`),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const simulations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Simulation[];
      callback(simulations);
    });
  },

  /** Subscribe to real-time budget tracking */
  getBudgetTracking: (cycleId: string, callback: (budget: BudgetTracking | null) => void): (() => void) => {
    const budgetRef = ref(rtdb, `budgetTracking/${cycleId}`);

    return onValue(budgetRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as BudgetTracking);
      } else {
        callback(null);
      }
    });
  },

  // ---------------------------------------------------------------------------
  // WRITE operations (via Cloud Functions)
  // ---------------------------------------------------------------------------

  runSimulation: async (data: {
    cycleId: string;
    name: string;
    description?: string;
    parameters: SimulationParameters;
  }): Promise<{ success: boolean; simulationId: string; results: Simulation['results'] }> => {
    const fn = httpsCallable<typeof data, { success: boolean; simulationId: string; results: Simulation['results'] }>(
      functions,
      'runBudgetSimulation'
    );
    const result = await fn(data);
    return result.data;
  },

  saveSimulation: async (data: {
    cycleId: string;
    simulationId: string;
    name: string;
    description?: string;
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'saveSimulationScenario'
    );
    const result = await fn(data);
    return result.data;
  },

  deleteSimulation: async (data: {
    cycleId: string;
    simulationId: string;
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'deleteSimulationScenario'
    );
    const result = await fn(data);
    return result.data;
  },

  applyScenario: async (data: {
    cycleId: string;
    simulationId: string;
  }): Promise<{ success: boolean }> => {
    const fn = httpsCallable<typeof data, { success: boolean }>(
      functions,
      'applyScenarioToCycle'
    );
    const result = await fn(data);
    return result.data;
  }
};