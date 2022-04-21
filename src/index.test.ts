import { ALWAYSAI_CONFIG_DIR, ConfigFile } from './index';
const pkg = require('../package');

describe(pkg.name, () => {
  it(`exports a constructor function ${ConfigFile.name} and a string constant ALWAYSAI_CONFIG_DIR`, () => {
    expect(typeof ConfigFile).toBe('function');
    expect(typeof ALWAYSAI_CONFIG_DIR).toBe('string');
  });
});
