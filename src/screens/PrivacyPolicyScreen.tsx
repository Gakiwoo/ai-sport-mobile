import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type Props = StackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="返回"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>隐私政策</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>更新日期：2025年5月14日</Text>

        <Section title="1. 引言">
          <Paragraph>
            AI运动助手（以下简称"本应用"或"我们"）尊重并保护您的隐私。本隐私政策旨在说明我们如何收集、使用、存储和保护您的个人信息。请在使用本应用前仔细阅读。
          </Paragraph>
        </Section>

        <Section title="2. 我们收集的信息">
          <Paragraph>本应用收集的信息范围如下：</Paragraph>
          <Bullet text="账号信息：注册时提供的邮箱地址、昵称，用于用户身份识别和登录验证。" />
          <Bullet text="运动数据：训练过程中的动作计数、训练时长、训练历史记录，用于提供训练分析和统计。" />
          <Bullet text="设备权限：相机权限（用于实时姿态检测）、相册权限（可选，用于头像设置）。" />
          <Bullet text="使用数据：应用崩溃日志、错误报告，用于改进应用稳定性。" />
        </Section>

        <Section title="3. 摄像头与姿态检测">
          <Paragraph>
            本应用的核心功能通过摄像头实时检测您的运动姿态。关于此功能，您需要了解：
          </Paragraph>
          <Bullet text="所有摄像头图像处理均在设备本地完成，不会上传至任何服务器。" />
          <Bullet text="MediaPipe Pose 检测在 WebView 中本地运行，检测数据不离开您的设备。" />
          <Bullet text="我们不会录制、存储或传输您的摄像头画面。" />
          <Bullet text="您可以随时在系统设置中关闭应用的相机权限。" />
        </Section>

        <Section title="4. 信息的存储与安全">
          <Paragraph>我们采取以下措施保护您的信息：</Paragraph>
          <Bullet text="登录令牌（Token）使用设备安全存储（iOS Keychain / Android Keystore）加密保存。" />
          <Bullet text="网络通信使用 HTTPS 加密传输。" />
          <Bullet text="训练数据存储在设备本地 AsyncStorage 中。" />
          <Bullet text="我们不会将您的个人信息出售或分享给第三方用于其营销目的。" />
        </Section>

        <Section title="5. 第三方服务">
          <Paragraph>本应用使用了以下第三方服务：</Paragraph>
          <Bullet text="MediaPipe（Google）：用于本地姿态检测，不传输数据至外部服务器。" />
          <Bullet text="自建后端 API（gakiwoo.com）：用于用户认证及同步，仅传输必要的账号信息。" />
          <Bullet text="Expo 生态库：各 Expo 模块仅在设备本地运行，不涉及数据传输。" />
          <Paragraph>以上第三方服务均遵循其各自的隐私政策。</Paragraph>
        </Section>

        <Section title="6. 儿童隐私">
          <Paragraph>
            本应用不面向未满13周岁的儿童。我们不会故意收集儿童的个人信息。如发现误收集了儿童信息，请立即联系我们，我们将尽快删除。
          </Paragraph>
        </Section>

        <Section title="7. 您的权利">
          <Paragraph>您享有以下权利：</Paragraph>
          <Bullet text="访问权：通过个人中心查看您的账号信息。" />
          <Bullet text="更正权：在个人中心修改您的昵称。" />
          <Bullet text="删除权：通过登出功能清除本地登录状态；联系后端删除服务器数据。" />
          <Bullet text="撤回同意权：在系统设置中关闭相机权限。" />
        </Section>

        <Section title="8. 隐私政策的更新">
          <Paragraph>
            我们可能会不时更新本隐私政策。更新后的政策将在应用内公布并注明更新日期。继续使用本应用即表示您同意更新后的政策。
          </Paragraph>
        </Section>

        <Section title="9. 联系我们">
          <Paragraph>如您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：</Paragraph>
          <Bullet text="邮箱：wu_jiaqi@sina.cn" />
          <Bullet text="应用内反馈：个人中心页面" />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── 子组件 ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ── 样式 ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
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
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 22,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 22,
    marginRight: 6,
    width: 10,
  },
  bulletText: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 22,
    flex: 1,
  },
});
