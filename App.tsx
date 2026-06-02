import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LocaleProvider, useLocale } from './src/contexts/LocaleContext';
import { t } from './src/i18n';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { RootStackParamList } from './src/types/navigation';
import { mediaPipeAssetService } from './src/services/MediaPipeAssetService';
import { shouldPreloadMediaPipeAssets } from './src/utils/mediaPipeCdnPolicy';

const Stack = createStackNavigator<RootStackParamList>();

// ── 认证守卫：根据登录状态决定显示哪些页面 ──
function AuthGate() {
  const { user, isLoading } = useAuth();
  useLocale(); // 订阅语言变化以触发重新渲染
  const mediaPipePreloadStartedRef = useRef(false);

  // 登录/游客入口渲染后后台预热模型，不阻塞首屏。
  useEffect(() => {
    if (shouldPreloadMediaPipeAssets({
      authLoading: isLoading,
      alreadyStarted: mediaPipePreloadStartedRef.current,
    })) {
      mediaPipePreloadStartedRef.current = true;
      mediaPipeAssetService.preload().catch((err) => {
        console.log('[App] MediaPipe preload skipped:', err?.message ?? err);
      });
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={user ? 'Home' : 'Login'}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F2F2F7' },
      }}
    >
      {/* 未登录 */}
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          {/* 已登录 */}
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="Workout"
            component={WorkoutScreen}
            options={{ headerShown: true, title: t('nav.workout'), headerTintColor: '#1C1C1E' }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ headerShown: true, title: t('nav.history'), headerTintColor: '#1C1C1E' }}
          />
          <Stack.Screen
            name="Analytics"
            component={AnalyticsScreen}
            options={{ headerShown: true, title: t('nav.analytics'), headerTintColor: '#1C1C1E' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: true, title: t('nav.profile'), headerTintColor: '#1C1C1E' }}
          />
        </>
      )}
      {/* 公共页面（无需登录也可访问） */}
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LocaleProvider>
          <AuthProvider>
            <NavigationContainer>
              <AuthGate />
            </NavigationContainer>
          </AuthProvider>
        </LocaleProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
});
