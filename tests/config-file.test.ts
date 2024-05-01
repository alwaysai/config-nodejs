import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import * as t from 'io-ts';
import * as tempy from 'tempy';

import { join } from 'path';
import { ConfigFile } from '../src/config-file';

const codec = t.intersection([
  t.type({
    foo: t.string
  }),
  t.partial({ baz: t.string })
]);

const path = tempy.file();

const initialValue = {
  foo: 'foo'
};

const subject = ConfigFile({
  path,
  codec,
  initialValue
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
    subject.update((config) => {
      config.foo = 'bar';
    });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ foo: 'bar' });
  });

  it('"update" uses the provided default config if the file does not exist', () => {
    subject.remove();
    subject.update(() => {});
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(initialValue);
  });

  it('"update" throws if the updater returns a value', () => {
    expect(() => subject.update(() => ({ foo: 'bar' }))).toThrow('Mutate');
  });

  it('"update" throws if the there is no initial nor current value', () => {
    expect(() =>
      ConfigFile({ path: join(path, 'no-initial-value.json'), codec }).update(
        () => {}
      )
    ).toThrow('ENOENT');
  });

  it('read/write sanity check', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    expect(subject.read()).toEqual(config);
  });

  it('initialize writes the file if it does not already exist', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    subject.initialize();
    expect(subject.read()).toEqual(config);
    subject.remove();
    subject.initialize();
    expect(subject.read()).toEqual(initialValue);
  });

  it('initialize throws if no initial value is provided', () => {
    const configFile = ConfigFile({
      path: join(path, 'no-initial-value-2.json'),
      codec
    });
    expect(configFile.initialize).toThrow('initialValue');
  });

  it('write throws EACCES', () => {
    const tmpDir = tempy.directory();
    chmodSync(tmpDir, 0o000);
    const configFile = ConfigFile({
      path: join(tmpDir, 'test.json'),
      codec,
      initialValue,
      EACCES: { code: 'foo', message: 'bar' }
    });
    expect(configFile.initialize).toThrow('bar');
    chmodSync(tmpDir, 0o777);
  });

  it('read throws ENOENT', () => {
    const configFile = ConfigFile({
      path: tempy.file(),
      codec,
      ENOENT: { code: 'foo', message: 'bar' }
    });
    expect(() => configFile.read()).toThrow('bar');
  });

  it('read throws EACCES', () => {
    const tmpPath = tempy.file();
    const configFile = ConfigFile({
      path: tmpPath,
      codec,
      initialValue,
      EACCES: { code: 'foo', message: 'bar' }
    });
    configFile.initialize();
    chmodSync(tmpPath, 0o000);
    expect(() => configFile.read()).toThrow('bar');
    chmodSync(tmpPath, 0o777);
  });
});
