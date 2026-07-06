export const documentDirectory = 'file:///document/';
export const cacheDirectory = 'file:///cache/';

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

export const getInfoAsync = jest.fn(async (uri: string) => ({
  exists: false,
  isDirectory: uri.endsWith('/'),
  uri,
  size: 0,
}));

export const makeDirectoryAsync = jest.fn(() => Promise.resolve());
export const readAsStringAsync = jest.fn(() => Promise.resolve(''));
export const writeAsStringAsync = jest.fn(() => Promise.resolve());
export const deleteAsync = jest.fn(() => Promise.resolve());
export const downloadAsync = jest.fn(async (_url: string, fileUri: string) => ({
  uri: fileUri,
  status: 200,
  headers: {},
}));
