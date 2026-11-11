import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require('../package.json')
const file = path.join(dir, '../hel_dist/hel-meta.json')
if (!fs.existsSync(file)) throw new Error('请先运行 pnpm build')
const meta = JSON.parse(fs.readFileSync(file, 'utf8'))
if (meta.app?.build_version !== pkg.version) throw new Error('package.json 与 hel-meta.json 版本不一致')
