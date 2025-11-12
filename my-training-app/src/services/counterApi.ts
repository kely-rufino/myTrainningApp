// Counter API
export interface CounterResponse {
  success: boolean;
  message: string;
  data: {
    count: number;
    lastUpdated: string;
  };
}

// Backend base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Helper function to make HTTP requests
async function fetchApi(endpoint: string, options?: RequestInit): Promise<CounterResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export const counterApi = {
  // Get current counter value
  async getCounter(): Promise<CounterResponse> {
    return await fetchApi('/counter');
  },

  // Increment counter
  async incrementCounter(): Promise<CounterResponse> {
    return await fetchApi('/counter/increment', {
      method: 'POST',
    });
  },

  // Decrement counter
  async decrementCounter(): Promise<CounterResponse> {
    return await fetchApi('/counter/decrement', {
      method: 'POST',
    });
  },

  // Reset counter
  async resetCounter(): Promise<CounterResponse> {
    return await fetchApi('/counter/reset', {
      method: 'POST',
    });
  }
};