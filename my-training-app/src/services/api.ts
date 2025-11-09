// Mock API service to simulate backend endpoints
export interface TestResponse {
  success: boolean;
  message: string;
  timestamp: string;
  data?: unknown;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  language: 'en' | 'pt' | 'es';
  notifications: boolean;
  autoSave: boolean;
}

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock settings storage (in a real app, this would be in a database)
let mockSettings: AppSettings = {
  theme: 'light',
  language: 'en',
  notifications: true,
  autoSave: false
};

export const apiService = {
  // Test endpoint to check if settings are working
  async testSettings(): Promise<TestResponse> {
    await delay(1000); // Simulate network delay
    
    try {
      return {
        success: true,
        message: 'Settings endpoint is working correctly!',
        timestamp: new Date().toISOString(),
        data: {
          currentSettings: mockSettings,
          serverStatus: 'online',
          version: '1.0.0'
        }
      };
    } catch {
      return {
        success: false,
        message: 'Failed to test settings endpoint',
        timestamp: new Date().toISOString()
      };
    }
  },

  // Get current settings
  async getSettings(): Promise<TestResponse> {
    await delay(500);
    
    return {
      success: true,
      message: 'Settings retrieved successfully',
      timestamp: new Date().toISOString(),
      data: mockSettings
    };
  },

  // Update settings
  async updateSettings(newSettings: Partial<AppSettings>): Promise<TestResponse> {
    await delay(800);
    
    try {
      mockSettings = { ...mockSettings, ...newSettings };
      
      return {
        success: true,
        message: 'Settings updated successfully',
        timestamp: new Date().toISOString(),
        data: mockSettings
      };
    } catch {
      return {
        success: false,
        message: 'Failed to update settings',
        timestamp: new Date().toISOString()
      };
    }
  },

  // Test connectivity
  async testConnectivity(): Promise<TestResponse> {
    await delay(300);
    
    const isOnline = Math.random() > 0.1; // 90% success rate
    
    return {
      success: isOnline,
      message: isOnline ? 'Connection successful' : 'Connection failed',
      timestamp: new Date().toISOString(),
      data: {
        latency: Math.floor(Math.random() * 100) + 50,
        server: 'api.mytrainingapp.com',
        region: 'us-east-1'
      }
    };
  }
};