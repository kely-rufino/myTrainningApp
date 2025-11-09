// Simulação de API para o counter
export interface CounterResponse {
  success: boolean;
  message: string;
  data: {
    count: number;
    lastUpdated: string;
  };
}

// Simula delay de rede
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Estado simulado do contador (em uma app real seria no backend)
const counterState = {
  count: 0,
  lastUpdated: new Date().toISOString()
};

export const counterApi = {
  // Buscar o valor atual do contador
  async getCounter(): Promise<CounterResponse> {
    await delay(300); // Simula latência
    
    return {
      success: true,
      message: 'Counter retrieved successfully',
      data: {
        count: counterState.count,
        lastUpdated: counterState.lastUpdated
      }
    };
  },

  // Incrementar o contador
  async incrementCounter(): Promise<CounterResponse> {
    await delay(500); // Simula latência
    
    try {
      counterState.count += 1;
      counterState.lastUpdated = new Date().toISOString();
      
      return {
        success: true,
        message: 'Counter incremented successfully',
        data: {
          count: counterState.count,
          lastUpdated: counterState.lastUpdated
        }
      };
    } catch {
      return {
        success: false,
        message: 'Failed to increment counter',
        data: {
          count: counterState.count,
          lastUpdated: counterState.lastUpdated
        }
      };
    }
  },

  // Decrementar o contador
  async decrementCounter(): Promise<CounterResponse> {
    await delay(500); // Simula latência
    
    try {
      counterState.count -= 1;
      counterState.lastUpdated = new Date().toISOString();
      
      return {
        success: true,
        message: 'Counter decremented successfully',
        data: {
          count: counterState.count,
          lastUpdated: counterState.lastUpdated
        }
      };
    } catch {
      return {
        success: false,
        message: 'Failed to decrement counter',
        data: {
          count: counterState.count,
          lastUpdated: counterState.lastUpdated
        }
      };
    }
  },

  // Reset do contador
  async resetCounter(): Promise<CounterResponse> {
    await delay(400); // Simula latência
    
    try {
      counterState.count = 0;
      counterState.lastUpdated = new Date().toISOString();
      
      return {
        success: true,
        message: 'Counter reset successfully',
        data: {
          count: counterState.count,
          lastUpdated: counterState.lastUpdated
        }
      };
    } catch {
      return {
        success: false,
        message: 'Failed to reset counter',
        data: {
          count: counterState.count,
          lastUpdated: counterState.lastUpdated
        }
      };
    }
  }
};