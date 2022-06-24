import { ConfigFile, ConfigFileSchema } from './index';

describe('index', () => {
  test(`check exports`, () => {
    expect(typeof ConfigFile).toBe('function');
    expect(typeof ConfigFileSchema).toBe('function');
  });
});
