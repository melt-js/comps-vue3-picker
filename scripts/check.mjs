import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import helDevUtils from 'hel-dev-utils'
const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
helDevUtils.check(require('../package.json'), { fileFullPath: path.join(dir, '../src/configs/subApp.ts'), checkEnv: false })
