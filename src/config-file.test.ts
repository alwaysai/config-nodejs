import { existsSync, readFileSync, writeFileSync } from 'fs';

import * as tempy from 'tempy';

import * as t from 'io-ts';

import { ConfigFile } from './config-file';

const codec = t.intersection([
  t.type({
    foo: t.string,
  }),
  t.partial({ baz: t.string }),
]);

const path = tempy.file();

const initialValue = {
  foo: 'foo',
};

const subject = ConfigFile({
  path,
  codec,
  initialValue,
});

describe(ConfigFile.name, () => {
  beforeEach(() => {
    subject.remove();
  });

  it('"write" synchronously writes a file to the specified path', () => {
    expect(existsSync(path)).toBe(false);
    subject.write({ foo: 'foo', baz: undefined });
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
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ foo: 'bar' });
  });

  it('"update" uses the provided default config if the file does not exist', () => {
    subject.remove();
    subject.update(() => {});
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(initialValue);
  });

  it('read/write sanity check', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    expect(subject.read()).toEqual(config);
  });
});
