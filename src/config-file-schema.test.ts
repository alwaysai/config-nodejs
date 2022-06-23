import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import * as tempy from 'tempy';

import { ConfigFileSchema } from './config-file-schema';
import { join } from 'path';
import { JSONSchemaType } from 'ajv';

interface TestSchema {
  foo: string;
  baz?: string;
}

const schema: JSONSchemaType<TestSchema> = {
  type: 'object',
  properties: {
    foo: { type: 'string' },
    baz: { type: 'string', nullable: true },
  },
  required: ['foo'],
  additionalProperties: false,
};

const path = tempy.file();

const initialValue: TestSchema = {
  foo: 'foo',
};

const subject = ConfigFileSchema({
  path,
  schema,
  initialValue,
});

describe(ConfigFileSchema.name, () => {
  beforeEach(() => {
    subject.remove();
  });

  test('"write" synchronously writes a file to the specified path', () => {
    expect(existsSync(path)).toBe(false);
    subject.write({ foo: 'foo', baz: undefined });
    expect(existsSync(path)).toBe(true);
  });

  test('"write" returns the file contents as "serialized"', () => {
    const info = subject.write({ foo: 'foo' });
    expect(info.serialized).toEqual(readFileSync(path, 'utf8'));
  });

  test('"write" returns "changed" as `true` if it wrote the file, false otherwise', () => {
    let info = subject.write({ foo: '123' });
    expect(info.changed).toEqual(true);
    info = subject.write({ foo: '123' });
    expect(info.changed).toEqual(false);
  });

  test('"read" reads and parses as JSON the specified file path', () => {
    writeFileSync(path, '{"foo": "bar"}');
    const config = subject.read();
    expect(config).toEqual({ foo: 'bar' });
  });

  test('"update" updates the contents of the file', () => {
    writeFileSync(path, '{"foo": "foo"}');
    subject.update((config) => {
      config.foo = 'bar';
    });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ foo: 'bar' });
  });

  test('"update" uses the provided default config if the file does not exist', () => {
    subject.remove();
    subject.update(() => {});
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(initialValue);
  });

  test('"update" throws if the updater returns a value', () => {
    expect(() => subject.update(() => ({ foo: 'bar' }))).toThrow('Mutate');
  });

  test('"update" throws if the there is no initial nor current value', () => {
    expect(() =>
      ConfigFileSchema({ path: join(path, 'no-initial-value.json'), schema }).update(
        () => {},
      ),
    ).toThrow('ENOENT');
  });

  test('read/write sanity check', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    expect(subject.read()).toEqual(config);
  });

  test('initialize writes the file if it does not already exist', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    subject.initialize();
    expect(subject.read()).toEqual(config);
    subject.remove();
    subject.initialize();
    expect(subject.read()).toEqual(initialValue);
  });

  test('errors are undefined if validation succeeds', () => {
    const config = { foo: 'bar' };
    subject.write(config);
    expect(subject.getErrors()).toBe(null);
  });

  test('errors are provided when validation fails', () => {
    writeFileSync(path, '{"bar": "bar"}');
    expect(() => subject.read()).toThrow();
    expect(subject.getErrors()).toEqual([
      {
        instancePath: '',
        keyword: 'required',
        message: "must have required property 'foo'",
        params: { missingProperty: 'foo' },
        schemaPath: '#/required',
      },
    ]);
  });

  test('initialize throws if no initial value is provided', () => {
    const configFile = ConfigFileSchema({
      path: join(path, 'no-initial-value-2.json'),
      schema,
    });
    expect(configFile.initialize).toThrow('initialValue');
  });

  test('write throws EACCES', () => {
    const tmpDir = tempy.directory();
    chmodSync(tmpDir, 0o000);
    const configFile = ConfigFileSchema({
      path: join(tmpDir, 'test.json'),
      schema,
      initialValue,
      EACCES: { code: 'foo', message: 'bar' },
    });
    expect(configFile.initialize).toThrow('bar');
    chmodSync(tmpDir, 0o777);
  });

  test('read throws ENOENT', () => {
    const configFile = ConfigFileSchema({
      path: tempy.file(),
      schema,
      ENOENT: { code: 'foo', message: 'bar' },
    });
    expect(() => configFile.read()).toThrow('bar');
  });

  test('read throws EACCES', () => {
    const tmpPath = tempy.file();
    const configFile = ConfigFileSchema({
      path: tmpPath,
      schema,
      initialValue,
      EACCES: { code: 'foo', message: 'bar' },
    });
    configFile.initialize();
    chmodSync(tmpPath, 0o000);
    expect(() => configFile.read()).toThrow('bar');
    chmodSync(tmpPath, 0o777);
  });
});
