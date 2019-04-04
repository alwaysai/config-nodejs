import { homedir } from 'os';
import { join } from 'path';

export const ALWAYSAI_CONFIG_DIR = join(homedir(), '.config', 'alwaysai');
