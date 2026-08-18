import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, ApiRequestError } from '../services/ApiClient';
import AuthService from '../services/AuthService';
import { syncService } from '../services/SyncService';
import ErrorReporter from '../services/ErrorReporter';
import { ServerSettingsScreenProps } from '../types/navigation';

// ── 常量 ──
const SERVER_URL_KEY = '@server_settings_url';
const DEFAULT_SERVER_URL = 'http://localhost:3000/api';
const LAST_SYNC_KEY = '@server_settings_last_sync';

type ConnState = 'idle' | 'testing' | 'reachable' | 'unreachable';

interface ServerUser {
  id: number;
  username: string;
  role: string;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError && err.message) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export default function ServerSettingsScreen({ navigation }: ServerSettingsScreenProps) {
  const insets = useSafeAreaInsets();

  // ── 服务器连接 ──
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [connState, setConnState] = useState<ConnState>('idle');

  // ── 登录 ──
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [serverUser, setServerUser] = useState<ServerUser | null>(null);

  // ── 同步 ──
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  // 启动时读取已保存的服务器地址
  useEffect(() => {
    (async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
        if (savedUrl) {
          setServerUrl(savedUrl);
          apiClient.setBaseUrl(savedUrl);
        }
        const savedSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
        if (savedSync) {
          setLastSync(savedSync);
        }
      } catch (err) {
        ErrorReporter.captureWarning('读取服务器设置失败', {
          source: 'ServerSettingsScreen',
          error: getErrorMessage(err, '读取失败'),
        });
      }
    })();
  }, []);

  const persistServerUrl = async (url: string) => {
    try {
      await AsyncStorage.setItem(SERVER_URL_KEY, url);
    } catch (err) {
      ErrorReporter.captureWarning('保存服务器设置失败', {
        source: 'ServerSettingsScreen',
        error: getErrorMessage(err, '保存失败'),
      });
    }
  };

  // ── 测试连接：GET /auth/me 不带 token，期望 401 = 可达 ──
  const handleTestConnection = async () => {
    const url = serverUrl.trim();
    if (!url) {
      Alert.alert('提示', '请输入服务器地址');
      return;
    }
    setConnState('testing');
    setLoginError('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let status = 0;
      try {
        const res = await fetch(`${url}/auth/me`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        status = res.status;
      } finally {
        clearTimeout(timeoutId);
      }

      // 401 = 服务器可达且鉴权正常工作；其它非网络错误状态也视为可达
      if (status === 401) {
        setConnState('reachable');
        await persistServerUrl(url);
        apiClient.setBaseUrl(url);
      } else {
        setConnState('reachable');
        await persistServerUrl(url);
        apiClient.setBaseUrl(url);
        Alert.alert('已连接', `服务器响应状态码：${status}`);
      }
    } catch (err) {
      setConnState('unreachable');
      ErrorReporter.captureWarning('服务器连接测试失败', {
        source: 'ServerSettingsScreen',
        error: getErrorMessage(err, '连接失败'),
      });
    }
  };

  // ── 登录 ──
  const handleLogin = async () => {
    setLoginError('');
    if (!username.trim() || !password) {
      setLoginError('请输入用户名和密码');
      return;
    }
    setIsLoggingIn(true);
    try {
      const result = await apiClient.login(username.trim(), password);
      setServerUser(result.user);
      setPassword('');
    } catch (err) {
      setLoginError(getErrorMessage(err, '登录失败'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ── 退出登录 ──
  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出服务器账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          // P1-11 补漏：此页登录会经 ApiClient.persistTokens 写入 SecureStore，
          // 退出时必须同时清 SecureStore（AuthService.logout 撤销服务端会话并清本地），
          // 否则 refresh token 残留、AuthService 侧会话仍有效。
          await AuthService.logout().catch(() => {
            ErrorReporter.captureWarning('服务器设置页登出时撤销会话失败', {
              source: 'ServerSettingsScreen.handleLogout',
            });
          });
          apiClient.setTokens(null);
          setServerUser(null);
          setSyncFeedback('');
        },
      },
    ]);
  };

  // ── 立即同步 ──
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncFeedback('');
    try {
      const pushResult = await syncService.sync();
      const pullResult = await syncService.pull();

      const errors = [...pushResult.errors, ...pullResult.errors];
      const now = new Date().toISOString();
      setLastSync(now);
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);

      if (errors.length > 0) {
        setSyncFeedback(`同步完成，但存在问题：${errors.join('；')}`);
      } else {
        setSyncFeedback(
          `同步成功：上传 ${pushResult.synced} 条，跳过 ${pushResult.skipped} 条，拉取 ${pullResult.merged} 条`,
        );
      }
    } catch (err) {
      setSyncFeedback(`同步失败：${getErrorMessage(err, '未知错误')}`);
      ErrorReporter.captureWarning('手动同步失败', {
        source: 'ServerSettingsScreen',
        error: getErrorMessage(err, '同步失败'),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTimestamp = (iso: string | null): string => {
    if (!iso) return '从未同步';
    try {
      return new Date(iso).toLocaleString('zh-CN');
    } catch {
      return iso;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />

      {/* 顶栏 */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="返回"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>服务器设置</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.main} showsVerticalScrollIndicator={false}>
        {/* 服务器连接卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>服务器连接</Text>

          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder={DEFAULT_SERVER_URL}
            placeholderTextColor="#AEAEB2"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="服务器地址"
          />

          <View style={styles.rowBetween}>
            <TouchableOpacity
              style={[styles.primaryBtn, connState === 'testing' && styles.buttonDisabled]}
              onPress={handleTestConnection}
              disabled={connState === 'testing'}
              accessibilityLabel="测试连接"
              accessibilityRole="button"
            >
              {connState === 'testing' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>测试连接</Text>
              )}
            </TouchableOpacity>

            <View style={styles.statusRow}>
              {connState === 'reachable' && (
                <Text style={styles.statusOk} accessibilityLabel="服务器可达">
                  ✓ 已连接
                </Text>
              )}
              {connState === 'unreachable' && (
                <Text style={styles.statusFail} accessibilityLabel="服务器不可达">
                  ✕ 无法连接
                </Text>
              )}
              {connState === 'idle' && <Text style={styles.statusIdle}>未测试</Text>}
              {connState === 'testing' && <Text style={styles.statusIdle}>测试中…</Text>}
            </View>
          </View>
        </View>

        {/* 登录卡片（仅在服务器可达时显示） */}
        {connState === 'reachable' && !serverUser && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>账号登录</Text>

            {loginError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loginError}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              placeholderTextColor="#AEAEB2"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="用户名"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="密码"
              placeholderTextColor="#AEAEB2"
              secureTextEntry
              onSubmitEditing={handleLogin}
              accessibilityLabel="密码"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, isLoggingIn && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoggingIn}
              accessibilityLabel="登录"
              accessibilityRole="button"
            >
              {isLoggingIn ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>登录</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 已登录卡片 */}
        {serverUser && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>账号信息</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>用户名</Text>
              <Text style={styles.infoValue}>{serverUser.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>角色</Text>
              <Text style={styles.infoValue}>{serverUser.role}</Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              accessibilityLabel="退出登录"
              accessibilityRole="button"
            >
              <Text style={styles.logoutText}>退出登录</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 同步状态卡片（仅在已登录时显示） */}
        {serverUser && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>数据同步</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>上次同步</Text>
              <Text style={styles.infoValue}>{formatTimestamp(lastSync)}</Text>
            </View>

            {syncFeedback ? (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackText}>{syncFeedback}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, isSyncing && styles.buttonDisabled]}
              onPress={handleSync}
              disabled={isSyncing}
              accessibilityLabel="立即同步"
              accessibilityRole="button"
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>立即同步</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '600',
  },
  topbarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  main: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1C1E',
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusRow: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusOk: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34C759',
  },
  statusFail: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D4201A',
  },
  statusIdle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#D4201A',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  logoutBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D4201A',
  },
  feedbackBox: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginVertical: 10,
  },
  feedbackText: {
    fontSize: 13,
    color: '#3A3A3C',
    fontWeight: '500',
  },
});
