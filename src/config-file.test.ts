import { existsSync, readFileSync, writeFileSync } from 'fs';

import * as tempy from 'tempy';

import * as t from '@alwaysai/codecs';

import { ConfigFile } from './config-file';

const codec = t.intersection([
  t.type({
    foo: t.string,
    bar: t.nullableString,
  }),
  t.partial({ baz: t.string }),
]);

const path = tempy.file();
const subject = ConfigFile({
  path,
  codec,
});

describe(ConfigFile.name, () => {
  beforeEach(() => {
    subject.remove();
  });

  it('"write" synchronously writes a file to the specified path', () => {
    expect(existsSync(path)).toBe(false);
    subject.write({ foo: 'foo', bar: null, baz: undefined });
    expect(existsSync(path)).toBe(true);
  });

  it('"write" returns the file contents as "serialized"', () => {
    const info = subject.write({ foo: 'foo', bar: null });
    expect(info.serialized).toEqual(readFileSync(path, 'utf8'));
  });

  it('"write" returns "changed" as `true` if it wrote the file, false otherwise', () => {
    let info = subject.write({ foo: '123', bar: null });
    expect(info.changed).toEqual(true);
    info = subject.write({ foo: '123', bar: null });
    expect(info.changed).toEqual(false);
  });

  it('"read" reads and parses as JSON the specified file path', () => {
    writeFileSync(path, '{"foo": "bar", "bar": null}');
    const config = subject.read();
    expect(config).toEqual({ foo: 'bar', bar: null });
  });

  it('"update" updates the contents of the file', () => {
    writeFileSync(path, '{"foo": "foo", "bar": null }');
    subject.update(config => {
      config.foo = 'bar';
    });
    expect(readFileSync(path, 'utf8')).toEqual('{\n  "foo": "bar",\n  "bar": null\n}');
  });

  it('read/write sanity check', () => {
    const config = { foo: 'bar', bar: null };
    subject.write(config);
    expect(subject.read()).toEqual(config);
  });
});
