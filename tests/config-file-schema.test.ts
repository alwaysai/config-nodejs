import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import * as tempy from 'tempy';

import Ajv, { JSONSchemaType } from 'ajv';
import { join } from 'path';
import { ConfigFileSchema } from '../src/config-file-schema';

interface TestSchema {
  foo: string;
  baz?: string;
}

const schema: JSONSchemaType<TestSchema> = {
  type: 'object',
  properties: {
    foo: { type: 'string' },
    baz: { type: 'string', nullable: true }
  },
  required: ['foo'],
  additionalProperties: false
};

const ajv = new Ajv();

const validateFunction = ajv.compile(schema);

const path = tempy.file();

const initialValue: TestSchema = {
  foo: 'foo'
};

const subject = ConfigFileSchema({
  path,
  validateFunction,
  initialValue
});

const nodeMajorVersion = parseInt(process.versions.node);

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

  test('"read" reads and parses as JSON the specified file path without initial value', () => {
    writeFileSync(path, '{"foo": "bar"}');
    const testConfig = ConfigFileSchema({ path, validateFunction });
    const config = testConfig.read();
    expect(config).toEqual({ foo: 'bar' });
    expect(config.foo).toEqual('bar');
    testConfig.remove();
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
    subject.update(() => undefined);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(initialValue);
  });

  test('"update" throws if the updater returns a value', () => {
    expect(() => subject.update(() => ({ foo: 'bar' }))).toThrow('Mutate');
  });

  test('"update" throws if the there is no initial nor current value', () => {
    expect(() =>
      ConfigFileSchema({
        path: join(path, 'no-initial-value.json'),
        validateFunction
      }).update(() => undefined)
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
        schemaPath: '#/required'
      }
    ]);
  });

  test('initialize throws if no initial value is provided', () => {
    const configFile = ConfigFileSchema({
      path: join(path, 'no-initial-value-2.json'),
      validateFunction
    });
    expect(configFile.initialize).toThrow('initialValue');
  });

  test('write throws EACCES', () => {
    const tmpDir = tempy.directory();
    chmodSync(tmpDir, 0o000);
    const configFile = ConfigFileSchema({
      path: join(tmpDir, 'test.json'),
      validateFunction,
      initialValue,
      EACCES: { code: 'foo', message: 'bar' }
    });
    expect(configFile.initialize).toThrow('bar');
    chmodSync(tmpDir, 0o777);
  });

  test('read throws ENOENT', () => {
    const configFile = ConfigFileSchema({
      path: tempy.file(),
      validateFunction,
      ENOENT: { code: 'foo', message: 'bar' }
    });
    expect(() => configFile.read()).toThrow('bar');
  });

  test('read throws EACCES', () => {
    const tmpPath = tempy.file();
    const configFile = ConfigFileSchema({
      path: tmpPath,
      validateFunction,
      initialValue,
      EACCES: { code: 'foo', message: 'bar' }
    });
    configFile.initialize();
    chmodSync(tmpPath, 0o000);
    expect(() => configFile.read()).toThrow('bar');
    chmodSync(tmpPath, 0o777);
  });

  test('readParsed of invalid JSON throws error', () => {
    writeFileSync(path, '{"foo": "bar"');
    const testConfig = ConfigFileSchema({ path, validateFunction });
    expect(() => testConfig.readParsed()).toThrow();
  });

  test('read of invalid JSON (extra comma) throws default error when parseError provided with no message', () => {
    const invalidJsonValue = '{"foo": [1,2,]}';
    writeFileSync(path, invalidJsonValue);
    const testConfig = ConfigFileSchema({
      path,
      validateFunction,
      parseError: {}
    });
    const expectedMsg =
      nodeMajorVersion < 20
        ? 'Unexpected token ] in JSON at position 13'
        : `Unexpected token ']', \"${invalidJsonValue}\" is not valid JSON`; // eslint-disable-line no-useless-escape
    expect(() => testConfig.read()).toThrowError(
      `Contents of ${path} could not be parsed. Please ensure file is in a valid format. \n${expectedMsg}`
    );
  });

  test('read of invalid JSON (missing end brace) throws default error when parseError provided with no message', () => {
    const invalidJsonValue = '{"foo": [1,2,]';
    writeFileSync(path, invalidJsonValue);
    const testConfig = ConfigFileSchema({
      path,
      validateFunction,
      parseError: {}
    });
    const expectedMsg =
      nodeMajorVersion < 20
        ? 'Unexpected token ] in JSON at position 13'
        : `Unexpected token ']', \"${invalidJsonValue}\" is not valid JSON`; // eslint-disable-line no-useless-escape
    expect(() => testConfig.read()).toThrowError(
      `Contents of ${path} could not be parsed. Please ensure file is in a valid format. \n${expectedMsg}`
    );
  });

  test('read of invalid JSON throws custome error when parseError provided with message', () => {
    const invalidJsonValue = '{"foo": [1,2,]}';
    const errorMessage = 'NOT ABLE TO PARSE';
    writeFileSync(path, invalidJsonValue);
    const testConfig = ConfigFileSchema({
      path,
      validateFunction,
      parseError: { message: errorMessage }
    });
    const expectedMsg =
      nodeMajorVersion < 20
        ? `${errorMessage}\nUnexpected token ] in JSON at position 13`
        : `${errorMessage}\nUnexpected token ']', \"${invalidJsonValue}\" is not valid JSON`; // eslint-disable-line no-useless-escape
    expect(() => {
      testConfig.read();
    }).toThrowError(expectedMsg);
  });

  test('read of invalid JSON throws original error when parseError not provided', () => {
    writeFileSync(path, '{"foo": [1,2,]}');
    const testConfig = ConfigFileSchema({ path, validateFunction });
    expect(() => testConfig.read()).toThrowError(SyntaxError);
  });
});
