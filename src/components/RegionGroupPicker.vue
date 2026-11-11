<template>
  <div ref="rootEl" class="region-group-picker" :class="{ 'region-group-picker--inline': inline, 'is-disabled': disabled }">
    <button v-if="!inline" type="button" class="region-group-picker__trigger" :disabled="disabled" @click="toggle">
      <span :class="{ 'is-placeholder': !path.length }">{{ displayText || placeholder }}</span>
      <span class="region-group-picker__caret" :class="{ 'is-open': isOpen }" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
    </button>

    <div v-if="inline || isOpen" class="rg-group" :class="{ 'rg-group--dropdown': !inline }" @click.stop>
      <div class="rg-header">
        <div class="rg-header-text" :title="displayText || header">{{ displayText || header }}</div>
        <div class="rg-header-control">
          <span v-if="loading" class="rg-loading">⟳</span>
          <button type="button" class="rg-clear" title="清除选择" aria-label="清除选择" @click="clear">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 5 6 6m0-6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div class="rg-level-tabs" role="tablist">
        <button
          v-for="item of tabs"
          :key="item.index"
          type="button"
          role="tab"
          :aria-selected="levelIndex === item.index"
          :class="{ active: levelIndex === item.index }"
          @click="focusLevel(item.index)"
        >
          {{ item.title }}
        </button>
      </div>

      <div class="rg-results-container">
        <div class="rg-results">
          <button
            v-for="item of list"
            :key="String(item.key)"
            type="button"
            class="rg-item"
            :class="{ active: path[levelIndex]?.key === item.key }"
            :disabled="disabled || !item.selectable"
            @click="selectItem(item)"
          >
            {{ item.title }}
          </button>
          <div v-if="!loading && !list.length" class="rg-message-box">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Key = string | number
type RawData = Record<string, any>
type LevelKey = 'province' | 'city' | 'area' | 'town'

interface RegionOption {
  datas?: RawData[] | (() => RawData[])
  getTotalDatas?: (success: (data: RawData[]) => void, fail?: () => void) => void | Promise<RawData[]>
  keyName?: string
  titleName?: string
  childrenName?: string
  parentName?: string
  dataMode?: 'tree' | 'list'
  selectable?: (data: RawData, level: number) => boolean
}

interface RegionNode {
  key: Key
  title: string
  value: RawData
  parentKey: Key | null
  children: RegionNode[]
  level: number
  selectable: boolean
}

const props = withDefaults(defineProps<{
  option?: RegionOption
  modelValue?: Record<string, Key | undefined> | null
  inline?: boolean
  disabled?: boolean
  placeholder?: string
  header?: string
  separator?: string
  levelLabels?: string[]
}>(), {
  option: () => ({}),
  modelValue: null,
  inline: false,
  disabled: false,
  placeholder: '请选择行政区划',
  header: '行政区划',
  separator: '',
  levelLabels: () => ['省/直辖市', '市', '区/县', '乡/镇/街道'],
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: Record<string, Key | undefined>): void
  (event: 'input' | 'update' | 'clear', value: Record<string, Key | undefined>): void
  (event: 'update:names', value: string[]): void
  (event: 'change', value: Record<string, { key: Key; value: string } | undefined>): void
  (event: 'complete'): void
  (event: 'loadDataSuccess'): void
}>()

const levelKeys: LevelKey[] = ['province', 'city', 'area', 'town']
const rootEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const loading = ref(false)
const roots = ref<RegionNode[]>([])
const nodes = ref<Record<string, RegionNode>>({})
const path = ref<RegionNode[]>([])
const levelIndex = ref(0)
const list = ref<RegionNode[]>([])
const valueBak = ref<Record<string, Key | undefined> | null>(null)

const option = computed<Required<Pick<RegionOption, 'keyName' | 'titleName' | 'childrenName' | 'parentName' | 'dataMode'>> & RegionOption>(() => ({
  keyName: 'key',
  titleName: 'title',
  childrenName: 'children',
  parentName: 'parentKey',
  dataMode: 'tree',
  ...props.option,
}))
const depth = computed(() => Math.min(levelKeys.length, treeDepth(roots.value)))
const tabs = computed(() => props.levelLabels.slice(0, depth.value).map((title, index) => ({ title, index })))
const displayText = computed(() => path.value.map((item) => item.title).join(props.separator))

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value) } catch { /* noop */ }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function keyOf(value: unknown): Key | null {
  return typeof value === 'string' || typeof value === 'number' ? value : value == null ? null : String(value)
}

function generateTree(datas: RawData[]) {
  const byKey = new Map<string, RawData>()
  const result: RawData[] = []
  for (const item of datas) byKey.set(String(item[option.value.keyName]), item)
  for (const item of datas) {
    const parent = byKey.get(String(item[option.value.parentName]))
    if (!parent) result.push(item)
    else (parent[option.value.childrenName] ||= []).push(item)
  }
  return result
}

function buildNodes(datas: RawData[], parentKey: Key | null, level: number): RegionNode[] {
  return datas.map((data) => {
    const key = keyOf(data[option.value.keyName]) ?? `${level}-${Math.random().toString(36).slice(2)}`
    const node: RegionNode = {
      key,
      title: String(data[option.value.titleName] ?? key),
      value: data,
      parentKey,
      children: [],
      level,
      selectable: option.value.selectable ? option.value.selectable(data, level) : data.selectable !== false,
    }
    const children = Array.isArray(data[option.value.childrenName]) ? data[option.value.childrenName] : []
    node.children = buildNodes(children, key, level + 1)
    nodes.value[String(key)] = node
    return node
  })
}

function treeDepth(items: RegionNode[], current = 0): number {
  if (!items.length) return current
  return Math.max(...items.map((item) => treeDepth(item.children, current + 1)))
}

function initDatas(datas: RawData[]) {
  nodes.value = {}
  const source = option.value.dataMode === 'list' ? generateTree(clone(datas)) : clone(datas)
  roots.value = buildNodes(source, null, 0)
  parseValue()
}

function init() {
  const source = option.value.datas
  let datas = Array.isArray(source) ? source : typeof source === 'function' ? source() : []
  if (!option.value.getTotalDatas) {
    initDatas(datas)
    return
  }
  loading.value = true
  const success = (result: RawData[] = []) => {
    loading.value = false
    initDatas(result)
    emit('loadDataSuccess')
  }
  const fail = () => { loading.value = false }
  try {
    const result = option.value.getTotalDatas(success, fail)
    if (result && typeof result.then === 'function') result.then(success).catch(fail)
  } catch { fail() }
}

function parseValue() {
  const next: RegionNode[] = []
  for (const key of levelKeys) {
    const value = props.modelValue?.[key]
    if (value === undefined || value === null || value === '') break
    const node = nodes.value[String(value)]
    if (!node || node.level !== next.length) break
    if (next.length && String(node.parentKey) !== String(next.at(-1)!.key)) break
    next.push(node)
  }
  path.value = next
  focusLevel(0)
}

function values() {
  return Object.fromEntries(levelKeys.slice(0, depth.value).map((key, index) => [key, path.value[index]?.key]))
}

function models() {
  return Object.fromEntries(levelKeys.slice(0, depth.value).map((key, index) => {
    const item = path.value[index]
    return [key, item ? { key: item.key, value: item.title } : undefined]
  }))
}

function update(trigger: 'picker' | 'clear') {
  const value = values()
  valueBak.value = clone(value)
  emit('input', value)
  emit('update:modelValue', value)
  emit('update', value)
  emit('update:names', path.value.map((item) => item.title))
  emit('change', models())
  if (trigger === 'clear') emit('clear', value)
}

function selectItem(item: RegionNode) {
  if (props.disabled || !item.selectable) return
  path.value.splice(levelIndex.value)
  path.value.push(item)
  update('picker')
  const next = levelIndex.value + 1
  if (item.children.length && next < depth.value) {
    focusLevel(next)
    return
  }
  emit('complete')
  if (!props.inline) close()
}

function focusLevel(index: number) {
  levelIndex.value = index
  list.value = index === 0 ? roots.value : path.value[index - 1]?.children || []
}

function clear() {
  path.value = []
  focusLevel(0)
  update('clear')
  if (!props.inline) close()
}

function toggle() {
  if (!props.disabled) isOpen.value = !isOpen.value
}

function close() { isOpen.value = false }
function onDocumentDown(event: MouseEvent) {
  if (isOpen.value && rootEl.value && !rootEl.value.contains(event.target as Node)) close()
}

watch(() => props.modelValue, () => {
  if (JSON.stringify(valueBak.value) === JSON.stringify(props.modelValue)) return
  parseValue()
}, { deep: true })
watch(() => props.option?.datas, init, { deep: true })
watch(() => props.disabled, (value) => { if (value) close() })
onMounted(() => {
  document.addEventListener('mousedown', onDocumentDown)
  init()
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentDown))

defineExpose({ clear, close, open: () => { if (!props.disabled) isOpen.value = true }, refresh: init, dispose: values })
</script>

<style>
.region-group-picker { position: relative; display: inline-block; width: 280px; color: #495060; font-size: 14px; line-height: 1.5; vertical-align: middle; }
.region-group-picker--inline { width: 400px; max-width: 100%; }
.region-group-picker__trigger { position: relative; display: flex; align-items: center; width: 100%; min-height: 36px; box-sizing: border-box; padding: 4px 32px 4px 10px; border: 1px solid #d5d8de; border-radius: 3px; background: #fff; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.region-group-picker__trigger:hover { border-color: #57a3f3; box-shadow: 0 0 0 2px rgba(45, 140, 240, .12); }
.region-group-picker__trigger:disabled { background: #f5f6f7; color: #c5c8ce; cursor: not-allowed; box-shadow: none; }
.region-group-picker__trigger span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.region-group-picker__trigger .is-placeholder { color: #c5c8ce; }
.region-group-picker__caret { position: absolute; top: 0; right: 0; display: flex; align-items: center; justify-content: center; width: 32px; height: 100%; color: #84909e; pointer-events: none; transition: color .2s, transform .2s; }
.region-group-picker__caret svg { display: block; width: 16px; height: 16px; }
.region-group-picker__caret.is-open { transform: rotate(180deg); }
.rg-group { width: 400px; max-width: 100%; overflow: hidden; border: 1px solid #e5e5e5; border-radius: 4px; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .14); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
.rg-group--dropdown { position: absolute; z-index: 1000; top: calc(100% + 5px); left: 0; max-width: min(400px, calc(100vw - 24px)); box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }
.rg-header { display: flex; align-items: center; justify-content: space-between; min-height: 34px; box-sizing: border-box; padding: 7px 10px; background: #f4f4f4; }
.rg-header-text { flex: 1; min-width: 0; overflow: hidden; color: #666; text-overflow: ellipsis; white-space: nowrap; }
.rg-header-control { display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; }
.rg-clear { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #84909e; cursor: pointer; transition: color .16s, background .16s; }
.rg-clear:hover { background: #eef4fb; color: #3979bd; }
.rg-clear svg { display: block; width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.rg-loading { color: #2d8cf0; animation: rg-spin 1s linear infinite; }
.rg-level-tabs { display: flex; overflow-x: auto; padding: 0 10px; background: #f4f4f4; white-space: nowrap; }
.rg-level-tabs button { flex: 0 0 auto; padding: 8px 16px 5px; border: 0; border-radius: 8px 8px 0 0; background: transparent; color: #bbb; cursor: pointer; font: inherit; font-weight: 600; line-height: 1.43; }
.rg-level-tabs button.active { background: #fff; color: #333; box-shadow: 0 3px 12px rgba(0, 0, 0, .2); }
.rg-results-container { max-height: 300px; overflow: auto; background: #fff; }
.rg-results { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 5px; width: 400px; max-width: 100%; min-height: 42px; box-sizing: border-box; padding: 10px; }
.rg-item { display: inline-flex; flex: 0 0 auto; padding: 3px 10px; border: 0; border-radius: 8px; background: transparent; color: #777; cursor: pointer; font: inherit; white-space: nowrap; }
.rg-item:hover { background: #f5f5f5; color: #000; }
.rg-item.active { background: #e3e3e3; color: #000; }
.rg-item:disabled { color: #bbb; cursor: not-allowed; }
.rg-message-box { width: 100%; padding: 10px; color: #aaa; text-align: center; }
@keyframes rg-spin { to { transform: rotate(360deg); } }
</style>
