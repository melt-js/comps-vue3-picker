import type { Component } from 'vue'
import { exposeLib } from 'hel-lib-proxy'
import { LIB_NAME } from '../configs/subApp'

export type CompTypes = { CategoryPicker: Component; RegionGroupPicker: Component }
export const dtlib = exposeLib<CompTypes>(LIB_NAME)
export default dtlib
