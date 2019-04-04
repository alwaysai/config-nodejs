import { existsSync, readFileSync, writeFileSync } from 'fs';

import * as t from 'io-ts';
import * as tempy from 'tempy';

import { ConfigFile } from './config-file';

const path = tempy.file();
const codec = t.partial({
  foo: t.string,
});
const subject = ConfigFile(path, codec);

describe(ConfigFile.name, () => {
  beforeEach(() => {
    subject.remove();
  });

  it('"write" synchronously writes a file to the specified path', () => {
    expect(existsSync(path)).toBe(false);
    subject.write({});
    expect(existsSync(path)).toBe(true);
  });

  it('"write" returns the file contents as "serialized"', () => {
    const info = subject.write({ foo: 'foo' });
    expect(info.serialized).toEqual(readFileSync(path, 'utf8'));
  });

  it('"write" returns "changed" as `true` if it wrote the file, false otherwise', () => {
    let info = subject.write({ foo: '123' });
    expect(info.changed).toEqual(true);
    info = subject.write({ foo: '123' });
    expect(info.changed).toEqual(false);
  });

  it('"read" reads and parses as JSON the specified file path', () => {
    writeFileSync(path, '{"foo": "bar"}');
    const config = subject.read();
    expect(config).toEqual({ foo: 'bar' });
  });

  it('"update" updates the contents of the file', () => {
    writeFileSync(path, '{"foo": "foo"}');
    subject.update(config => {
      config.foo = 'bar';
    });
    expect(readFileSync(path, 'utf8')).toEqual('{\n  "foo": "bar"\n}');
  });

  it('read/write sanity check', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    expect(subject.read()).toEqual(config);
  });
});
