import { StackScreenProps } from '@react-navigation/stack';
import { ExerciseType } from './index';

export type RootStackParamList = {
  // 认证相关
  Login: undefined;
  Register: undefined;
  Profile: undefined;
  // 功能页面
  Home: undefined;
  Workout: { exerciseType: ExerciseType };
  History: undefined;
  Analytics: undefined;
  Pilot: undefined;
  PrivacyPolicy: undefined;
  ServerSettings: undefined;
};

export type LoginScreenProps = StackScreenProps<RootStackParamList, 'Login'>;
export type RegisterScreenProps = StackScreenProps<RootStackParamList, 'Register'>;
export type ProfileScreenProps = StackScreenProps<RootStackParamList, 'Profile'>;
export type HomeScreenProps = StackScreenProps<RootStackParamList, 'Home'>;
export type WorkoutScreenProps = StackScreenProps<RootStackParamList, 'Workout'>;
export type HistoryScreenProps = StackScreenProps<RootStackParamList, 'History'>;
export type AnalyticsScreenProps = StackScreenProps<RootStackParamList, 'Analytics'>;
export type PilotScreenProps = StackScreenProps<RootStackParamList, 'Pilot'>;
export type PrivacyPolicyScreenProps = StackScreenProps<RootStackParamList, 'PrivacyPolicy'>;
export type ServerSettingsScreenProps = StackScreenProps<RootStackParamList, 'ServerSettings'>;
