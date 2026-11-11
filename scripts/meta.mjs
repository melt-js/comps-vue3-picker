import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import helDevUtils from 'hel-dev-utils'
import appInfo from '../appInfo.mjs'
const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
await helDevUtils.extractHelMetaJson({ appInfo, buildDirFullPath: path.join(dir, '../hel_dist'), packageJson: require('../package.json') })
