import { isMasterApp } from 'hel-iso'
import { libReady } from 'hel-lib-proxy'
import { LIB_NAME } from './configs/subApp'
import 'uno.css'

;(async () => {
  const lib = await import('./entrance/libProperties')
  libReady(LIB_NAME, lib.default, { platform: 'picker' })
  if (isMasterApp()) await import('./loadApp')
})().catch((error) => console.error('[comps-vue3-picker] 启动失败:', error))
