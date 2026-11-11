<template>
  <div ref="rootEl" :class="categoryCls" :disabled="disabled || undefined" @keydown.esc="close">
    <div
      v-if="!inline"
      class="h-categorypicker-show"
      :class="{ 'h-pop-trigger': isOpen }"
      role="combobox"
      tabindex="0"
      :aria-expanded="isOpen"
      :aria-disabled="disabled"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <div v-if="multiple && objects.length" class="h-categorypicker-multiple-tags">
        <span v-for="(item, index) of objects" :key="`${index}-${String(item.key)}`">
          <span>{{ getShow(item) }}</span>
          <button v-if="!disabled" type="button" class="h-icon-close-min" aria-label="删除" @click.stop="remove(item)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 5 6 6m0-6-6 6" /></svg>
          </button>
        </span>
      </div>
      <div v-else-if="!multiple && object" class="h-categorypicker-value-single">
        <span>{{ getShow(object) }}</span>
        <button v-if="!disabled" type="button" class="h-icon-close" aria-label="清除" title="清除选择" @mousedown.prevent.stop="clear">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 5 6 6m0-6-6 6" /></svg>
        </button>
      </div>
      <div v-else class="h-categorypicker-placeholder">{{ showPlaceholder }}</div>
      <span class="h-categorypicker-arrow" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
    </div>

    <div v-if="inline || isOpen" :class="groupCls" @click.stop>
      <div class="h-categorypicker-tabs" role="tablist">
        <button
          v-for="(item, index) of tabs"
          :key="String(item.key)"
          type="button"
          role="tab"
          class="h-categorypicker-tab"
          :class="{ active: tab === item.key }"
          :aria-selected="tab === item.key"
          @click="focusTab(item, index)"
        >
          {{ item.title }}
        </button>
      </div>

      <div class="h-categorypicker-ul" :class="{ 'h-categorypicker-single-picker': !multiple }">
        <div v-if="globalloading && !list.length" class="h-categorypicker-empty">加载中…</div>
        <div v-else-if="!list.length" class="h-categorypicker-empty">暂无数据</div>
        <div
          v-for="data of list"
          :key="String(data.key)"
          class="h-categorypicker-item"
          :class="{
            'h-categorypicker-item-selected': object && data.key == object.key,
            'h-categorypicker-item-disabled': multiple ? !data.status.checkable : !data.status.selectable,
          }"
        >
          <span v-if="data.status.loading" class="h-icon-loading">⟳</span>
          <input
            v-else-if="data.status.checkable && multiple"
            type="checkbox"
            class="h-checkbox"
            :checked="isChecked(data)"
            :disabled="disabled"
            @change="change(data)"
            @click.stop
          />
          <span class="h-categorypicker-item-title" @click="openNew(data, $event)">
            {{ data.title }}<span v-if="showChildCount && data.children.length">({{ data.children.length }})</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Key = string | number
type RawData = Record<string, any>
type TotalLoader = (success: (data: RawData[]) => void, fail?: () => void) => void | Promise<RawData[]>
type ChildLoader = (data: RawData | null, success: (data: RawData[]) => void, fail?: () => void) => void | Promise<RawData[]>

interface PickerOption {
  datas?: RawData[] | (() => RawData[])
  getTotalDatas?: TotalLoader
  getDatas?: ChildLoader
  keyName?: string
  titleName?: string
  childrenName?: string
  parentName?: string
  dataMode?: 'tree' | 'list'
  selectable?: (data: RawData, level: number) => boolean
  checkable?: (data: RawData, level: number) => boolean
}

interface CategoryNode {
  key: Key
  title: string
  value: any
  parentKey: Key | null
  children: CategoryNode[]
  status: {
    level: number
    loading: boolean
    isWait: boolean
    opened: boolean
    selected: boolean
    selectable: boolean
    checkable: boolean
  }
}

const props = withDefaults(defineProps<{
  option?: PickerOption
  multiple?: boolean
  type?: 'key' | 'object' | string
  disabled?: boolean
  limit?: number
  placeholder?: string
  filterable?: boolean
  showAllLevels?: boolean
  showChildCount?: boolean
  inline?: boolean
  modelValue?: string | number | RawData | Array<string | number | RawData> | null
  config?: string
  className?: string
}>(), {
  option: () => ({}),
  multiple: false,
  type: 'key',
  disabled: false,
  filterable: true,
  showAllLevels: true,
  showChildCount: false,
  inline: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue' | 'input' | 'update' | 'clear' | 'setvalue', value: any): void
  (event: 'loadDataSuccess'): void
  (event: 'change', value: any): void
  (event: 'limit', limit: number): void
}>()

const topMenu = '-------'
const rootEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const globalloading = ref(false)
const objects = ref<CategoryNode[]>([])
const object = ref<CategoryNode | null>(null)
const tabs = ref<Array<{ title: string; key: Key; children?: CategoryNode[] }>>([{ title: '全部', key: topMenu }])
const tab = ref<Key>(topMenu)
const tabIndex = ref(0)
const categoryDatas = ref<CategoryNode[]>([])
const categoryObj = ref<Record<string, CategoryNode>>({})
const list = ref<CategoryNode[]>([])
const valueBak = ref<any>(null)

const param = computed<Required<Pick<PickerOption, 'keyName' | 'titleName' | 'childrenName' | 'parentName' | 'dataMode'>> & PickerOption>(() => ({
  keyName: 'key',
  titleName: 'title',
  childrenName: 'children',
  parentName: 'parentKey',
  dataMode: 'tree',
  ...props.option,
}))
const showPlaceholder = computed(() => props.placeholder || '请选择')
const categoryCls = computed(() => ({
  'h-categorypicker': true,
  'h-categorypicker-input-border': true,
  'h-categorypicker-no-autosize': true,
  'h-categorypicker-multiple': props.multiple,
  'h-categorypicker-disabled': props.disabled,
  'h-categorypicker-inline': props.inline,
}))
const groupCls = computed(() => ({
  'h-categorypicker-group': true,
  'h-categorypicker-group-inline': props.inline,
  'h-categorypicker-multiple': props.multiple,
  [`${props.className}-dropdown`]: Boolean(props.className),
}))

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
  const roots: RawData[] = []
  for (const data of datas) byKey.set(String(data[param.value.keyName]), data)
  for (const data of datas) {
    const rawParent = data[param.value.parentName]
    const parentKeys = Array.isArray(rawParent) ? rawParent : [rawParent]
    let found = false
    for (const parentKey of parentKeys) {
      const parent = byKey.get(String(parentKey))
      if (!parent) continue
      found = true
      const children = (parent[param.value.childrenName] ||= []) as RawData[]
      if (!children.includes(data)) children.push(data)
    }
    if (rawParent === null || rawParent === undefined || !found) roots.push(data)
  }
  return roots
}

function initTreeModeData(datas: RawData[], parentKey: Key | null, isWait: boolean, level: number): CategoryNode[] {
  return datas.map((data) => {
    const key = keyOf(data[param.value.keyName]) ?? `${level}-${Math.random().toString(36).slice(2)}`
    const node: CategoryNode = {
      key,
      title: String(data[param.value.titleName] ?? key),
      value: data,
      parentKey,
      children: [],
      status: {
        level,
        loading: false,
        isWait,
        opened: false,
        selected: false,
        selectable: param.value.selectable ? param.value.selectable(data, level) : data.selectable !== false,
        checkable: param.value.checkable ? param.value.checkable(data, level) : data.checkable !== false,
      },
    }
    const children = Array.isArray(data[param.value.childrenName]) ? data[param.value.childrenName] : []
    node.children = initTreeModeData(children, key, isWait, level + 1)
    categoryObj.value[String(key)] = node
    return node
  })
}

function getValue(item: unknown): CategoryNode | null {
  if (item === null || item === undefined) return null
  if (props.type === 'key') return categoryObj.value[String(item)] || null
  if (typeof item !== 'object') {
    return createLooseNode(item as Key, String(item), item)
  }
  const raw = item as RawData
  const key = keyOf(raw[param.value.keyName])
  if (key !== null && categoryObj.value[String(key)]) return categoryObj.value[String(key)]
  return createLooseNode(key ?? String(raw[param.value.titleName] ?? ''), String(raw[param.value.titleName] ?? key ?? ''), raw)
}

function createLooseNode(key: Key, title: string, value: any): CategoryNode {
  return {
    key,
    title,
    value,
    parentKey: null,
    children: [],
    status: { level: 0, loading: false, isWait: false, opened: false, selected: false, selectable: true, checkable: true },
  }
}

function parse() {
  if (props.multiple) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : []
    objects.value = values.map(getValue).filter((item): item is CategoryNode => Boolean(item))
    object.value = null
  } else {
    object.value = getValue(props.modelValue)
    objects.value = []
  }
}

function getParentTitle(data: CategoryNode): string[] {
  const result = [data.title]
  if (data.parentKey !== null && categoryObj.value[String(data.parentKey)]) result.push(...getParentTitle(categoryObj.value[String(data.parentKey)]))
  return result
}

function getShow(data: CategoryNode) {
  const current = categoryObj.value[String(data.key)] || data
  return props.showAllLevels ? getParentTitle(current).reverse().join('/') : current.title
}

function getParent(data: CategoryNode): RawData[] {
  const result = [clone(data.value)]
  if (data.parentKey !== null && categoryObj.value[String(data.parentKey)]) result.push(...getParent(categoryObj.value[String(data.parentKey)]))
  return result
}

function getFullData() {
  if (props.multiple) return objects.value.map((item) => getParent(categoryObj.value[String(item.key)] || item))
  return object.value ? getParent(categoryObj.value[String(object.value.key)] || object.value) : null
}

function getDisposeValue(item: any) {
  const result = { ...item }
  delete result[param.value.childrenName]
  return result
}

function dispose() {
  if (props.multiple) return objects.value.map((item) => props.type === 'key' ? item.key : getDisposeValue(item.value))
  if (!object.value) return null
  return props.type === 'key' ? object.value.key : getDisposeValue(object.value.value)
}

function setValue(trigger: string) {
  const value = dispose()
  emit('input', value)
  emit('update:modelValue', value)
  emit('update', value)
  emit('change', clone(props.multiple ? objects.value : object.value))
  if (trigger === 'clear') emit('clear', value)
  else valueBak.value = clone(value)
  emit('setvalue', value)
  nextTick(updateDropdown)
}

function remove(item: CategoryNode) {
  const index = objects.value.indexOf(item)
  if (index >= 0) objects.value.splice(index, 1)
  setValue('remove')
}

function clear() {
  object.value = null
  setValue('clear')
  close()
}

function isChecked(data: CategoryNode) {
  return props.multiple ? objects.value.some((item) => item.key == data.key) : object.value?.key == data.key
}

function change(data: CategoryNode) {
  if (props.disabled) return
  if (!props.multiple && !data.status.selectable) return
  if (props.multiple && !data.status.checkable) return
  if (props.multiple) {
    const selected = isChecked(data)
    if (!selected && props.limit !== undefined && objects.value.length >= props.limit) {
      emit('limit', props.limit)
      return
    }
    if (selected) objects.value = objects.value.filter((item) => item.key != data.key)
    else objects.value.push(data)
  } else {
    object.value = data
  }
  if (!props.inline && !props.multiple && !data.children.length && !data.status.isWait) close()
  setValue('picker')
}

function openNew(data: CategoryNode, event?: Event) {
  event?.stopPropagation()
  event?.preventDefault()
  if (data.children.length) {
    tabIndex.value += 1
    tabs.value.splice(tabIndex.value)
    tabs.value.push({ title: data.title, key: data.key, children: data.children })
    tab.value = data.key
    list.value = data.children
    if (!props.multiple) change(data)
    nextTick(updateDropdown)
    return
  }
  if (data.status.isWait) {
    loadChildren(data)
    return
  }
  change(data)
}

function loadChildren(data: CategoryNode) {
  const loader = param.value.getDatas
  if (!loader || data.status.loading) return
  data.status.loading = true
  const success = (result: RawData[] = []) => {
    data.children = initTreeModeData(clone(result), data.key, true, data.status.level + 1)
    data.status.isWait = false
    data.status.loading = false
    data.status.opened = true
    emit('loadDataSuccess')
    openNew(data)
  }
  const fail = () => { data.status.loading = false }
  try {
    const result = loader(data.value, success, fail)
    if (result && typeof result.then === 'function') result.then(success).catch(fail)
  } catch { fail() }
}

function focusTab(item: { title: string; key: Key; children?: CategoryNode[] }, index: number) {
  tab.value = item.key
  tabIndex.value = index
  list.value = item.key === topMenu ? categoryDatas.value : item.children || []
}

function initDatas(datas: RawData[]) {
  const source = param.value.dataMode === 'list' && datas.length ? generateTree(clone(datas)) : clone(datas)
  categoryObj.value = {}
  categoryDatas.value = initTreeModeData(source, null, Boolean(param.value.getDatas), 0)
  list.value = categoryDatas.value
  parse()
}

function initCategoryDatas() {
  const source = param.value.datas
  let datas = Array.isArray(source) ? source : typeof source === 'function' ? source() : []
  const loader = param.value.getTotalDatas || param.value.getDatas
  if (!loader) {
    initDatas(datas)
    return
  }
  datas = []
  globalloading.value = true
  const success = (result: RawData[] = []) => {
    globalloading.value = false
    initDatas(result)
    emit('loadDataSuccess')
  }
  const fail = () => { globalloading.value = false }
  try {
    const result = param.value.getDatas
      ? param.value.getDatas(null, success, fail)
      : param.value.getTotalDatas!(success, fail)
    if (result && typeof result.then === 'function') result.then(success).catch(fail)
  } catch { fail() }
  initDatas(datas)
}

function refresh() {
  tab.value = topMenu
  tabIndex.value = 0
  tabs.value = [{ title: '全部', key: topMenu }]
  initCategoryDatas()
}

function updateDropdown() {
  // HeyUI Dropdown.update() 的等价占位；原生定位不需要额外计算。
}

function toggle() {
  if (!props.inline && !props.disabled) isOpen.value = !isOpen.value
}
function close() { if (!props.inline) isOpen.value = false }
function onDocumentDown(event: MouseEvent) {
  if (isOpen.value && rootEl.value && !rootEl.value.contains(event.target as Node)) close()
}

watch(() => props.disabled, (value) => { if (value) close() })
watch(() => props.option?.datas, initCategoryDatas, { deep: true })
watch(() => props.modelValue, () => {
  if (JSON.stringify(valueBak.value) === JSON.stringify(props.modelValue)) return
  parse()
  tab.value = topMenu
  tabIndex.value = 0
  tabs.value = [{ title: '全部', key: topMenu }]
  list.value = categoryDatas.value
}, { deep: true })

onMounted(() => {
  document.addEventListener('mousedown', onDocumentDown)
  initCategoryDatas()
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentDown))

defineExpose({ refresh, dispose, getFullData, clear, close, open: () => { if (!props.disabled) isOpen.value = true } })
</script>

<style>
.h-categorypicker { position: relative; display: inline-block; box-sizing: border-box; width: 280px; color: #333; font-size: 14px; line-height: 1.5; vertical-align: middle; }
.h-categorypicker-inline { display: block; width: 100%; max-width: 500px; }
.h-categorypicker-show { position: relative; min-height: 36px; box-sizing: border-box; padding: 2px 36px 0 2px; border: 1px solid #eee; border-radius: 6px; background: #fff; cursor: default; transition: all linear .2s; }
.h-categorypicker-show:hover { border-color: #6ac79d; }
.h-categorypicker-show.h-pop-trigger { border-color: #45b984; box-shadow: 0 0 0 2px rgba(69, 185, 132, .2); }
.h-categorypicker-placeholder, .h-categorypicker-value-single { height: 30px; padding-left: 10px; overflow: hidden; line-height: 30px; text-overflow: ellipsis; white-space: nowrap; }
.h-categorypicker-placeholder { color: #787878; }
.h-categorypicker-value-single { padding-right: 48px; overflow: visible; }
.h-categorypicker-value-single > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h-categorypicker-arrow { position: absolute; top: 0; right: 0; display: flex; align-items: center; justify-content: center; width: 34px; height: 100%; color: #84909e; pointer-events: none; transition: color .2s, transform .2s; }
.h-categorypicker-arrow svg { display: block; width: 16px; height: 16px; }
.h-categorypicker-show:hover .h-categorypicker-arrow { color: #45b984; }
.h-categorypicker-show.h-pop-trigger .h-categorypicker-arrow { color: #45b984; transform: rotate(180deg); }
.h-categorypicker-multiple-tags { display: flex; flex-wrap: wrap; }
.h-categorypicker-multiple-tags > span { display: inline-flex; align-items: center; margin: 2px 5px 2px 0; padding: 0 8px; border: 1px solid #eee; border-radius: 0; background: #f5f5f5; font-size: 13px; }
.h-categorypicker-multiple-tags > span > span { max-width: 190px; overflow: hidden; line-height: 28px; text-overflow: ellipsis; white-space: nowrap; }
.h-icon-close, .h-icon-close-min { display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: #84909e; cursor: pointer; line-height: 1; transition: color .16s, background .16s; }
.h-icon-close svg, .h-icon-close-min svg { display: block; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.h-icon-close { position: absolute; top: 50%; right: 30px; width: 20px; height: 20px; border-radius: 50%; transform: translateY(-50%); }
.h-icon-close-min { flex: 0 0 auto; width: 18px; height: 18px; margin-left: 4px; border-radius: 50%; }
.h-icon-close:hover, .h-icon-close-min:hover { background: #eaf7f1; color: #239768; }
.h-categorypicker-disabled .h-categorypicker-show { border-color: #d3d3d3; background: #f5f5f5; color: #999; cursor: default; }
.h-categorypicker-disabled .h-categorypicker-show:hover { border-color: #d3d3d3; }
.h-categorypicker-group { position: absolute; z-index: 1000; top: calc(100% + 5px); left: 0; min-width: 300px; max-width: min(500px, calc(100vw - 24px)); overflow: hidden; border: 1px solid #eee; border-radius: 2px; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }
.h-categorypicker-group-inline { position: relative; top: auto; left: auto; width: 100%; max-width: 500px; margin-top: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, .08); }
.h-categorypicker-tabs { display: flex; overflow-x: auto; border-bottom: 1px solid #eee; white-space: nowrap; }
.h-categorypicker-tab { flex: 0 0 auto; margin-left: 20px; padding: 10px 0 8px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #666; cursor: pointer; font: inherit; }
.h-categorypicker-tab:first-child { margin-left: 15px; }
.h-categorypicker-tab.active { border-bottom-color: #45b984; color: #45b984; }
.h-categorypicker-ul { display: flex; flex-wrap: wrap; min-width: 300px; max-width: 500px; max-height: 300px; box-sizing: border-box; overflow-y: auto; padding: 15px 10px; }
.h-categorypicker-item { display: inline-flex; align-items: center; margin: 3px 8px; padding: 3px 6px; border-radius: 2px; cursor: pointer; }
.h-categorypicker-single-picker .h-categorypicker-item { padding: 2px 5px; }
.h-categorypicker-item:hover { background: #f3f3f3; }
.h-categorypicker-item-selected { background: #45b984; color: #fff; }
.h-categorypicker-item-selected:hover { background: #45b984; }
.h-categorypicker-item-disabled { color: #999; cursor: not-allowed; }
.h-categorypicker-item-title { display: inline-block; }
.h-checkbox { width: 14px; height: 14px; margin: 0 5px 0 0; accent-color: #45b984; }
.h-icon-loading { display: inline-flex; margin-right: 5px; color: #45b984; animation: h-picker-spin 1s linear infinite; }
.h-categorypicker-empty { width: 100%; padding: 20px 10px; color: #999; text-align: center; }
@keyframes h-picker-spin { to { transform: rotate(360deg); } }
</style>
