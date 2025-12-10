/**
 * Test script for configuration validation
 * 
 * Tests various configuration scenarios to ensure validation works correctly.
 * Run with: npm run test:config-validation
 */

import { ConfigValidator } from '../src/config-validator';

interface TestCase {
  name: string;
  config: {
    rehau: {
      email: string;
      password: string;
    };
    mqtt: {
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
    api: {
      port: number;
    };
  };
  env?: Record<string, string>;
  expectedValid: boolean;
  expectedErrors?: string[];
  expectedWarnings?: string[];
}

// Helper to set environment variables temporarily
function withEnv(env: Record<string, string>, fn: () => void): void {
  const originalEnv: Record<string, string | undefined> = {};
  
  // Save original values
  Object.keys(env).forEach(key => {
    originalEnv[key] = process.env[key];
  });
  
  // Set new values
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  try {
    fn();
  } finally {
    // Restore original values
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

function runTest(testCase: TestCase): boolean {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log('─'.repeat(60));
  
  let passed = true;
  
  // Set environment variables if provided
  if (testCase.env) {
    withEnv(testCase.env, () => {
      const result = ConfigValidator.validateConfig(testCase.config);
      
      // Check if validation result matches expectation
      if (result.isValid !== testCase.expectedValid) {
        console.log(`❌ FAIL: Expected valid=${testCase.expectedValid}, got valid=${result.isValid}`);
        passed = false;
      } else {
        console.log(`✅ Validation result matches expectation (valid=${result.isValid})`);
      }
      
      // Check for expected errors
      if (testCase.expectedErrors) {
        const errorFields = result.errors.map(e => e.field);
        const missingErrors = testCase.expectedErrors.filter(
          expected => !errorFields.includes(expected)
        );
        
        if (missingErrors.length > 0) {
          console.log(`❌ FAIL: Missing expected errors: ${missingErrors.join(', ')}`);
          passed = false;
        } else {
          console.log(`✅ All expected errors found`);
        }
        
        // Check for unexpected errors
        const unexpectedErrors = errorFields.filter(
          field => !testCase.expectedErrors!.includes(field)
        );
        if (unexpectedErrors.length > 0) {
          console.log(`⚠️  Unexpected errors: ${unexpectedErrors.join(', ')}`);
        }
      }
      
      // Check for expected warnings
      if (testCase.expectedWarnings) {
        const warningFields = result.warnings.map(w => w.field);
        const missingWarnings = testCase.expectedWarnings.filter(
          expected => !warningFields.includes(expected)
        );
        
        if (missingWarnings.length > 0) {
          console.log(`❌ FAIL: Missing expected warnings: ${missingWarnings.join(', ')}`);
          passed = false;
        } else {
          console.log(`✅ All expected warnings found`);
        }
      }
      
      // Print details
      if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        result.errors.forEach(err => {
          console.log(`  [${err.severity.toUpperCase()}] ${err.field}: ${err.message}`);
        });
      }
      
      if (result.warnings.length > 0) {
        console.log(`\nWarnings (${result.warnings.length}):`);
        result.warnings.forEach(warn => {
          console.log(`  [WARNING] ${warn.field}: ${warn.message}`);
        });
      }
    });
  } else {
    // No env vars to set, just validate config
    const result = ConfigValidator.validateConfig(testCase.config);
    
    if (result.isValid !== testCase.expectedValid) {
      console.log(`❌ FAIL: Expected valid=${testCase.expectedValid}, got valid=${result.isValid}`);
      passed = false;
    } else {
      console.log(`✅ Validation result matches expectation (valid=${result.isValid})`);
    }
    
    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      result.errors.forEach(err => {
        console.log(`  [${err.severity.toUpperCase()}] ${err.field}: ${err.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`);
      result.warnings.forEach(warn => {
        console.log(`  [WARNING] ${warn.field}: ${warn.message}`);
      });
    }
  }
  
  return passed;
}

// Test cases
const testCases: TestCase[] = [
  // Test 1: Valid configuration
  {
    name: 'Valid configuration',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3',
      LOG_LEVEL: 'info',
      USE_GROUP_IN_NAMES: 'false'
    },
    expectedValid: true,
    expectedErrors: [],
    expectedWarnings: []
  },
  
  // Test 2: Missing REHAU email
  {
    name: 'Missing REHAU email',
    config: {
      rehau: {
        email: '',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    expectedValid: false,
    expectedErrors: ['REHAU_EMAIL']
  },
  
  // Test 3: Invalid email format
  {
    name: 'Invalid email format',
    config: {
      rehau: {
        email: 'not-an-email',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    expectedValid: false,
    expectedErrors: ['REHAU_EMAIL']
  },
  
  // Test 4: Short password (warning)
  {
    name: 'Short password (should warn)',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'short'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    expectedValid: true,
    expectedWarnings: ['REHAU_PASSWORD']
  },
  
  // Test 5: Invalid MQTT port (too high)
  {
    name: 'MQTT port out of range (too high)',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 70000
      },
      api: {
        port: 3000
      }
    },
    expectedValid: false,
    expectedErrors: ['MQTT_PORT']
  },
  
  // Test 6: Invalid API port (too low, requires root)
  {
    name: 'API port too low (requires root)',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 80
      }
    },
    expectedValid: false,
    expectedErrors: ['API_PORT']
  },
  
  // Test 7: MQTT username without password
  {
    name: 'MQTT username without password',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883,
        username: 'mqttuser'
      },
      api: {
        port: 3000
      }
    },
    expectedValid: false,
    expectedErrors: ['MQTT_PASSWORD']
  },
  
  // Test 8: Invalid hostname
  {
    name: 'Invalid MQTT hostname',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'invalid..hostname',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    expectedValid: false,
    expectedErrors: ['MQTT_HOST']
  },
  
  // Test 9: Valid IPv4 address
  {
    name: 'Valid IPv4 address',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: '192.168.1.100',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3'
    },
    expectedValid: true
  },
  
  // Test 10: Interval out of range (too low)
  {
    name: 'ZONE_RELOAD_INTERVAL too low',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '10', // Below minimum of 30
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3'
    },
    expectedValid: false,
    expectedErrors: ['ZONE_RELOAD_INTERVAL']
  },
  
  // Test 11: Interval out of range (too high)
  {
    name: 'TOKEN_REFRESH_INTERVAL too high',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '100000', // Above maximum of 86400
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3'
    },
    expectedValid: false,
    expectedErrors: ['TOKEN_REFRESH_INTERVAL']
  },
  
  // Test 12: Invalid LOG_LEVEL
  {
    name: 'Invalid LOG_LEVEL',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3',
      LOG_LEVEL: 'invalid_level'
    },
    expectedValid: true,
    expectedWarnings: ['LOG_LEVEL']
  },
  
  // Test 13: Invalid USE_GROUP_IN_NAMES
  {
    name: 'Invalid USE_GROUP_IN_NAMES',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3',
      USE_GROUP_IN_NAMES: 'maybe'
    },
    expectedValid: true,
    expectedWarnings: ['USE_GROUP_IN_NAMES']
  },
  
  // Test 14: LIVE_DATA_INTERVAL too low
  {
    name: 'LIVE_DATA_INTERVAL too low',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '30', // Below minimum of 60
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3'
    },
    expectedValid: false,
    expectedErrors: ['LIVE_DATA_INTERVAL']
  },
  
  // Test 15: COMMAND_MAX_RETRIES out of range
  {
    name: 'COMMAND_MAX_RETRIES out of range',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '15' // Above maximum of 10
    },
    expectedValid: false,
    expectedErrors: ['COMMAND_MAX_RETRIES']
  },
  
  // Test 16: MQTT password without username (warning)
  {
    name: 'MQTT password without username (warning)',
    config: {
      rehau: {
        email: 'test@example.com',
        password: 'password123'
      },
      mqtt: {
        host: 'localhost',
        port: 1883,
        password: 'mqttpass'
      },
      api: {
        port: 3000
      }
    },
    env: {
      ZONE_RELOAD_INTERVAL: '300',
      TOKEN_REFRESH_INTERVAL: '21600',
      REFERENTIALS_RELOAD_INTERVAL: '86400',
      LIVE_DATA_INTERVAL: '300',
      COMMAND_RETRY_TIMEOUT: '30',
      COMMAND_MAX_RETRIES: '3'
    },
    expectedValid: true,
    expectedWarnings: ['MQTT_USER']
  }
];

// Run all tests
console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 Configuration Validation Test Suite');
console.log('═══════════════════════════════════════════════════════════════');

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase) => {
  const passed = runTest(testCase);
  if (passed) {
    passedTests++;
  } else {
    failedTests++;
  }
});

// Summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 Test Summary');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Total tests: ${testCases.length}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
}

