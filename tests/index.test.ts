import { ConfigFile, ConfigFileSchema } from '../src/index';

describe('index', () => {
  test(`check exports`, () => {
    expect(typeof ConfigFile).toBe('function');
    expect(typeof ConfigFileSchema).toBe('function');
  });
});
