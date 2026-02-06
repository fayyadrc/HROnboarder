/**
 * Mock API for HR Automator
 * Uses localStorage to persist data.
 */

const STORAGE_KEY = 'hr_automator_case';
const DELAY_MS = 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getStoredCase = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

const setStoredCase = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const api = {
  login: async (applicationNumber) => {
    await delay(DELAY_MS);
    
    // Simulate finding a case or creating a new one
    // For simplicity, we'll reset or create a new session if provided valid number
    if (!applicationNumber) throw new Error('Application number required');

    let currentCase = getStoredCase();
    
    // If no case exists or different app number (simulated), create fresh
    if (!currentCase || currentCase.applicationNumber !== applicationNumber) {
      currentCase = {
        applicationNumber,
        caseId: `CASE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        candidateName: 'Rikhil', // Hardcoded as per requirements
        status: 'DRAFT', // DRAFT, NEGOTIATION_PENDING, ON_HOLD_HR, SUBMITTED
        currentStepIndex: 0,
        steps: {},
        completedSteps: [],
      };
      setStoredCase(currentCase);
    }

    return currentCase;
  },

  getCase: async () => {
    await delay(500); // Shorter delay for polling/loading
    return getStoredCase();
  },

  saveStep: async (stepKey, payload) => {
    await delay(500); // Autosave speed
    const currentCase = getStoredCase();
    if (!currentCase) throw new Error('No active session');

    currentCase.steps = {
      ...currentCase.steps,
      [stepKey]: payload,
    };
    setStoredCase(currentCase);
    return currentCase;
  },

  submitStep: async (stepKey, payload, nextStepIndex) => {
    await delay(DELAY_MS);
    const currentCase = getStoredCase();
    if (!currentCase) throw new Error('No active session');

    // Save payload
    currentCase.steps = {
      ...currentCase.steps,
      [stepKey]: payload,
    };

    // Mark complete
    if (!currentCase.completedSteps.includes(stepKey)) {
      currentCase.completedSteps.push(stepKey);
    }

    // Advance step
    if (typeof nextStepIndex === 'number') {
      currentCase.currentStepIndex = nextStepIndex;
    }

    setStoredCase(currentCase);
    return currentCase;
  },

  setStatus: async (status) => {
    await delay(500);
    const currentCase = getStoredCase();
    if (!currentCase) throw new Error('No active session');
    
    currentCase.status = status;
    setStoredCase(currentCase);
    return currentCase;
  },

  simulateDocAnalysis: async (fileName) => {
    await delay(1500);
    // Mock random result
    const rand = Math.random();
    if (rand > 0.8) {
      return { status: 'warning', message: 'Low quality' };
    } else if (rand > 0.95) {
      return { status: 'error', message: 'Wrong document type' };
    }
    return { status: 'success', message: 'Looks good' };
  }
};
