import { dirname, isAbsolute } from 'path';
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import * as t from 'io-ts';

import { cast } from '@alwaysai/codecs';

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

export function ConfigFile<T extends t.HasProps>(path: string, codec: T) {
  if (!isAbsolute(path)) {
    throw new Error('Expected "path" to be absolute');
  }

  type Config = t.TypeOf<typeof codec>;

  function readRaw() {
    const serialized = readFileSync(path, { encoding: 'utf8' });
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
    const tmpFilePath = `${path}.tmp`;
    mkdirp.sync(dirname(tmpFilePath));
    writeFileSync(tmpFilePath, serialized);
    try {
      renameSync(tmpFilePath, path);
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
    const validated = cast(codec as any, parsed);
    return validated as Config;
  }

  function write(config: Config) {
    const validated = cast(codec as any, config);
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

  function update(updater: (config: Config) => void) {
    const config = read();
    updater(config);
    const info = write(config);
    return info;
  }

  return {
    read,
    write,
    remove,
    update,
    get path() {
      return path;
    },
  };
}
