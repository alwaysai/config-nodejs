import { dirname, resolve } from 'path';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync
} from 'fs';
import { CodedError } from '@carnesen/coded-error';
import mkdirp = require('mkdirp');
import { ErrorObject, ValidateFunction } from 'ajv';

function parse(serialized: string) {
  const parsed: any = JSON.parse(serialized);
  return parsed;
}

function serialize(config: any) {
  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  return serialized;
}

function RandomString() {
  return Math.random().toString(36).substring(2);
}

function isErrnoException(error: any): error is NodeJS.ErrnoException {
  return (
    Object.prototype.hasOwnProperty.call(error, 'code') ||
    Object.prototype.hasOwnProperty.call(error, 'errno')
  );
}

export interface ConfigFileSchemaReturnType<T> {
  path: string;
  read: () => T;
  readIfExists: () => T | undefined;
  readRaw: () => string;
  readParsed: () => any;
  write: (config: T) => SerializedInfoType;
  writeRaw: (serialized: string) => InfoType;
  remove: () => InfoType;
  update: (updater: (config: T) => void) => InfoType;
  exists: () => boolean;
  initialize: () => void;
  validate: ValidateFunction<T>;
  getErrors: () =>
    | ErrorObject<string, Record<string, any>, unknown>[]
    | null
    | undefined;
}

export interface InfoType {
  changed: boolean;
}

export interface SerializedInfoType extends InfoType {
  serialized: string;
}

export function ConfigFileSchema<T>(opts: {
  path: string;
  validateFunction: ValidateFunction<T>;
  ENOENT?: {
    message?: string;
    code?: any;
  };
  EACCES?: {
    message?: string;
    code?: any;
  };
  parseError?: {
    message?: string;
    code?: any;
  };
  initialValue?: T;
}): ConfigFileSchemaReturnType<T> {
  const path = resolve(opts.path);
  type Config = T;
  const validate = opts.validateFunction;

  return {
    path,
    read,
    readIfExists,
    readRaw,
    readParsed,
    write,
    writeRaw,
    remove,
    update,
    exists,
    initialize,
    validate,
    getErrors
  };

  function readRaw() {
    let serialized: string;
    try {
      serialized = readFileSync(path, { encoding: 'utf8' });
    } catch (ex) {
      if (isErrnoException(ex)) {
        if (ex.code === 'ENOENT' && opts.ENOENT) {
          const message = opts.ENOENT.message || ex.message || 'File not found';
          const code = opts.ENOENT.code || 'ENOENT';
          throw new CodedError(message, code);
        } else if (ex.code === 'EACCES' && opts.EACCES) {
          const message =
            opts.EACCES.message ||
            ex.message ||
            'Permission not granted on file';
          const code = opts.EACCES.code || 'EACCES';
          throw new CodedError(message, code);
        }
      }
      throw ex;
    }
    return serialized;
  }

  function writeRaw(serialized: string) {
    const info = {
      changed: false
    };
    if (existsSync(path) && serialized === readRaw()) {
      return info;
    }
    info.changed = true;
    const tmpFilePath = `${path}.${RandomString()}.tmp`;
    try {
      mkdirp.sync(dirname(tmpFilePath));
      writeFileSync(tmpFilePath, serialized);
    } catch (ex) {
      if (isErrnoException(ex)) {
        if (ex.code === 'EACCES' && opts.EACCES) {
          const message =
            opts.EACCES.message ||
            ex.message ||
            'Permission not granted on file';
          const code = opts.EACCES.code || 'EACCES';
          throw new CodedError(message, code);
        }
      }
      throw ex;
    }
    try {
      renameSync(tmpFilePath, path);
    } catch (exception) {
      try {
        unlinkSync(tmpFilePath);
      } finally {
        // TODO: EI-1252: not sure what is the reason to raise exception here.
        // As it will blow up and terminate running application.
        // Since this package is used as a dependency in other packages and ultimately in CLI and device-agent
        // eslint-disable-next-line no-unsafe-finally
        throw exception;
      }
    }
    return info;
  }

  function readParsed() {
    const serialized = readRaw();
    try {
      const parsed = parse(serialized);
      return parsed;
    } catch (ex: any) {
      if (ex instanceof SyntaxError) {
        if (opts.parseError) {
          const message =
            opts.parseError.message?.concat(`\n${ex.message}`) ||
            `Contents of ${path} could not be parsed. Please ensure file is in a valid format. \n${ex.message}`;
          const code = opts.parseError.code || 'parseError';
          throw new CodedError(message, code);
        }
      }
      throw ex;
    }
  }

  function read() {
    const parsed = readParsed();
    if (!validate(parsed)) {
      throw new Error(`Validation of ${path} failed!`);
    }
    return parsed as Config;
  }

  function exists() {
    return existsSync(path);
  }

  function readIfExists() {
    const maybeConfig: Config | undefined = exists() ? read() : undefined;
    return maybeConfig;
  }

  function write(config: Config) {
    if (!validate(config)) {
      throw new Error(`Validation of ${config} failed!`);
    }
    const serialized = serialize(config);
    const info = writeRaw(serialized);
    return { ...info, serialized };
  }

  function remove() {
    const value = {
      changed: false
    };
    if (existsSync(path)) {
      value.changed = true;
      unlinkSync(path);
    }
    return value;
  }

  function initialize() {
    if (typeof opts.initialValue === 'undefined') {
      throw new Error(
        '"initialize" can only be called if "initialValue" is provided'
      );
    }
    if (!exists()) {
      write(opts.initialValue);
    }
  }

  function update(updater: (config: Config) => void) {
    let config: Config;
    if (opts.initialValue) {
      config = readIfExists() || opts.initialValue;
    } else {
      config = read();
    }
    const returnValue = updater(config);
    // This mutates the config object ^^
    if (typeof returnValue !== 'undefined') {
      throw new Error(
        'Updater returned a value. Mutate the passed configuration instead.'
      );
    }
    const info = write(config);
    return info;
  }

  function getErrors() {
    return validate.errors;
  }
}
