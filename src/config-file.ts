import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { CodedError } from '@carnesen/coded-error';
import * as t from 'io-ts';
import mkdirp = require('mkdirp');
import parseJson = require('parse-json');

import { cast } from '@alwaysai/codecs';

function parse(serialized: string) {
  const parsed: any = parseJson(serialized);
  return parsed;
}

function serialize(config: any) {
  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  return serialized;
}

function RandomString() {
  return Math.random()
    .toString(36)
    .substring(2);
}

export function ConfigFile<T extends t.Mixed>(opts: {
  path: string;
  codec: T;
  ENOENT?: {
    message?: string;
    code?: any;
  };
  EACCES?: {
    message?: string;
    code?: any;
  };
  initialValue?: t.TypeOf<T>;
}) {
  const path = resolve(opts.path);
  type Config = t.TypeOf<T>;

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
  };

  function readRaw() {
    let serialized: string;
    try {
      serialized = readFileSync(path, { encoding: 'utf8' });
    } catch (ex) {
      if (ex.code === 'ENOENT' && opts.ENOENT) {
        const message = opts.ENOENT.message || ex.message || 'File not found';
        const code = opts.ENOENT.code || 'ENOENT';
        throw new CodedError(message, code);
      }
      else if (ex.code === 'EACCES' && opts.EACCES) {
        const message = opts.EACCES.message || ex.message || 'Permission not granded on file';
        const code = opts.EACCES.code || 'EACCES';
        throw new CodedError(message, code);
      }
      throw ex;
    }
    return serialized;
  }

  function writeRaw(serialized: string) {
    const info = {
      changed: false,
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
      if (ex.code === 'EACCES' && opts.EACCES) {
        const message = opts.EACCES.message || ex.message || 'Permission not granded on file';
        const code = opts.EACCES.code || 'EACCES';
        throw new CodedError(message, code);
      }
      throw ex;
    }
    try {
      renameSync(tmpFilePath, path);
    } catch (exception) {
      try {
        unlinkSync(tmpFilePath);
      } finally {
        throw exception;
      }
    }
    return info;
  }

  function readParsed() {
    const serialized = readRaw();
    const parsed = parse(serialized);
    return parsed;
  }

  function read() {
    const parsed = readParsed();
    const validated = cast(opts.codec as any, parsed);
    return validated as Config;
  }

  function exists() {
    return existsSync(path);
  }

  function readIfExists() {
    const maybeConfig: Config | undefined = exists() ? read() : undefined;
    return maybeConfig;
  }

  function write(config: Config) {
    const validated = cast(opts.codec as any, config);
    const serialized = serialize(validated);
    const info = writeRaw(serialized);
    return { ...info, serialized };
  }

  function remove() {
    const value = {
      changed: false,
    };
    if (existsSync(path)) {
      value.changed = true;
      unlinkSync(path);
    }
    return value;
  }

  function initialize() {
    if (typeof opts.initialValue === 'undefined') {
      throw new Error('"initialize" can only be called if "initialValue" is provided');
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
        'Updater returned a value. Mutate the passed configuration instead.',
      );
    }
    const info = write(config);
    return info;
  }
}