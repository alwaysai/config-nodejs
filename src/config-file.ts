import { dirname, isAbsolute } from 'path';
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { CodedError } from '@carnesen/coded-error';
import * as t from '@alwaysai/codecs';

import mkdirp = require('mkdirp');
import parseJson = require('parse-json');

function parse(serialized: string) {
  const parsed: any = parseJson(serialized);
  return parsed;
}

function serialize(config: any) {
  const serialized = JSON.stringify(config, null, 2);
  return serialized;
}

export function ConfigFile<T extends t.Mixed>(opts: {
  path: string;
  codec: T;
  ENOENT?: {
    message?: string;
    code?: any;
  };
}) {
  if (!isAbsolute(opts.path)) {
    throw new Error('Expected "path" to be absolute');
  }

  type Config = t.TypeOf<T>;

  function readRaw() {
    let serialized: string;
    try {
      serialized = readFileSync(opts.path, { encoding: 'utf8' });
    } catch (ex) {
      if (ex.code === 'ENOENT' && opts.ENOENT) {
        const message = opts.ENOENT.message || ex.message || 'File not found';
        const code = opts.ENOENT.code || 'ENOENT';
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
    if (existsSync(opts.path) && serialized === readRaw()) {
      return info;
    }
    info.changed = true;
    const tmpFilePath = `${opts.path}.tmp`;
    mkdirp.sync(dirname(tmpFilePath));
    writeFileSync(tmpFilePath, serialized);
    try {
      renameSync(tmpFilePath, opts.path);
    } catch (ex) {
      try {
        unlinkSync(tmpFilePath);
      } finally {
        throw ex;
      }
    }
    return info;
  }

  function read() {
    const serialized = readRaw();
    const parsed = parse(serialized);
    const validated = t.cast(opts.codec as any, parsed);
    return validated as Config;
  }

  function exists() {
    return existsSync(opts.path);
  }

  function readIfExists() {
    const maybeConfig: Config | undefined = exists() ? read() : undefined;
    return maybeConfig;
  }

  function write(config: Config) {
    const validated = t.cast(opts.codec as any, config);
    const serialized = serialize(validated);
    const info = writeRaw(serialized);
    return { ...info, serialized };
  }

  function remove() {
    const value = {
      changed: false,
    };
    if (existsSync(opts.path)) {
      value.changed = true;
      unlinkSync(opts.path);
    }
    return value;
  }

  function update(updater: (config: Config) => void) {
    const config = read();
    updater(config);
    const info = write(config);
    return info;
  }

  return {
    path: opts.path,
    read,
    readIfExists,
    write,
    remove,
    update,
    exists,
  };
}
