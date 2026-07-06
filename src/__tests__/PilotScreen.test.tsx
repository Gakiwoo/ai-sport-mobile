import React from 'react';
import { act } from 'react-test-renderer';
import * as Sharing from 'expo-sharing';
import PilotScreen from '../screens/PilotScreen';
import { createWithAct, flushPendingWork } from './testRenderer';

var mockExportLocalResultsFile: jest.Mock;
var mockGetEntities: jest.Mock;
var mockGetActiveSelection: jest.Mock;
var mockSetActiveSelection: jest.Mock;
var mockImportPackage: jest.Mock;

jest.mock('../services/PilotDataPackageService', () => {
  mockExportLocalResultsFile = jest.fn();
  mockGetEntities = jest.fn();
  mockGetActiveSelection = jest.fn();
  mockSetActiveSelection = jest.fn();
  mockImportPackage = jest.fn();

  return {
    pilotDataPackageService: {
      getEntities: mockGetEntities,
      getActiveSelection: mockGetActiveSelection,
      setActiveSelection: mockSetActiveSelection,
      importPackage: mockImportPackage,
      exportLocalResultsFile: mockExportLocalResultsFile,
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const pilotEntities = {
  schools: [{ id: 'school-demo', name: '试点学校' }],
  classes: [{ id: 'class-demo-1', schoolId: 'school-demo', name: '三年级 1 班' }],
  students: [
    {
      id: 'student-demo-1',
      schoolId: 'school-demo',
      classId: 'class-demo-1',
      name: '学生 A',
      gender: 'unknown',
    },
  ],
  devices: [],
  tasks: [
    {
      id: 'task-jump_rope',
      schoolId: 'school-demo',
      classId: 'class-demo-1',
      name: '跳绳',
      exerciseType: 'jump_rope',
      officialScoring: true,
    },
  ],
};

describe('PilotScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntities.mockResolvedValue(pilotEntities);
    mockGetActiveSelection.mockResolvedValue({
      schoolId: 'school-demo',
      classId: 'class-demo-1',
      studentId: 'student-demo-1',
      taskId: 'task-jump_rope',
    });
    mockSetActiveSelection.mockImplementation((selection) => Promise.resolve(selection));
    mockImportPackage.mockResolvedValue({ schools: 1, classes: 1, students: 1, tasks: 1 });
    mockExportLocalResultsFile.mockResolvedValue({
      uri: 'file:///document/pilot/ai-sport-results.json',
      dataPackage: {
        schemaVersion: 'pilot-v1',
        exportedAt: '2026-07-01T08:00:00.000Z',
        sourceApp: 'mobile',
        algorithmVersion: 'mobile-pose-v1',
        entities: { ...pilotEntities, sessions: [], reviews: [] },
      },
    });
  });

  it('shares exported pilot-v1 result packages', async () => {
    const instance = await createWithAct(
      <PilotScreen navigation={{ navigate: jest.fn() } as never} route={{ params: {} } as never} />,
    );
    const exportButton = instance.root
      .findAll(
        (node) =>
          String(node.type) === 'TouchableOpacity' &&
          node.findAll(
            (child) =>
              String(child.type) === 'Text' &&
              child.children.some((value) => value === '导出 pilot-v1 成绩包'),
          ).length > 0,
      )
      .at(0);

    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton!.props.onClick();
      await flushPendingWork();
    });

    expect(mockExportLocalResultsFile).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///document/pilot/ai-sport-results.json',
      expect.objectContaining({
        mimeType: 'application/json',
        dialogTitle: '分享 AI Sport 成绩包',
      }),
    );
  });
});
