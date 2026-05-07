import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorReport {
  timestamp: string;
  platform: string;
  version: string;
  os: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  componentStack?: string;
  userAgent?: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorReport = this.createErrorReport(error, errorInfo);
    
    console.error('ErrorBoundary caught:', error, errorInfo);
    console.error('Error Report:', JSON.stringify(errorReport, null, 2));
    
    this.setState({ error, errorInfo });
    
    this.logErrorToStorage(errorReport);
    
    this.props.onError?.(error, errorInfo);
  }

  private createErrorReport(error: Error, errorInfo: ErrorInfo): ErrorReport {
    return {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      version: '1.0.0',
      os: Platform.Version?.toString() || 'unknown',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack ?? undefined,
      userAgent: Platform.OS === 'web' ? navigator.userAgent : undefined,
    };
  }

  private async logErrorToStorage(report: ErrorReport): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const ERROR_LOG_KEY = '@error_log';
      
      const existingLogs = await AsyncStorage.getItem(ERROR_LOG_KEY);
      const logs: ErrorReport[] = existingLogs ? JSON.parse(existingLogs) : [];
      
      logs.push(report);
      
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
    } catch (err) {
      console.error('Failed to log error to storage:', err);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    const { Platform } = require('react-native');
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⚠️</Text>
          </View>
          
          <Text style={styles.title}>应用遇到问题</Text>
          
          <Text style={styles.message}>
            {this.state.error?.message || '发生了未知错误'}
          </Text>

          {__DEV__ && this.state.error?.stack && (
            <View style={styles.stackContainer}>
              <Text style={styles.stackTitle}>错误堆栈:</Text>
              <Text style={styles.stackText}>
                {this.state.error.stack.substring(0, 500)}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={this.handleReload}
            >
              <Text style={styles.primaryButtonText}>重新加载</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={this.handleRetry}
            >
              <Text style={styles.secondaryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            如果问题持续存在，请联系我们或检查网络连接
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export function useGlobalErrorHandler(): void {
  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      const originalHandler = ErrorUtils.getGlobalHandler?.() || global.onerror;
      
      const customHandler = (error: Error, isFatal?: boolean) => {
        const errorReport: ErrorReport = {
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
          version: '1.0.0',
          os: Platform.Version?.toString() || 'unknown',
          error: {
            name: 'GlobalError',
            message: error.message || String(error),
            stack: error.stack,
          },
        };
        
        console.error('Global Error:', errorReport);
        
        if (originalHandler) {
          return originalHandler(error, isFatal);
        }
        
        return false;
      };

      if (typeof ErrorUtils !== 'undefined') {
        ErrorUtils.setGlobalHandler?.(customHandler);
      }

      return () => {
        if (typeof ErrorUtils !== 'undefined') {
          ErrorUtils.setGlobalHandler?.(originalHandler);
        }
      };
    }
  }, []);
}

export async function getErrorLogs(): Promise<ErrorReport[]> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const ERROR_LOG_KEY = '@error_log';
    
    const logs = await AsyncStorage.getItem(ERROR_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (err) {
    console.error('Failed to get error logs:', err);
    return [];
  }
}

export async function clearErrorLogs(): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const ERROR_LOG_KEY = '@error_log';
    
    await AsyncStorage.removeItem(ERROR_LOG_KEY);
  } catch (err) {
    console.error('Failed to clear error logs:', err);
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  stackContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    maxHeight: 200,
    width: '100%',
  },
  stackTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 8,
  },
  stackText: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
