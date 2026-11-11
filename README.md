# @melt-js/comps-vue3-picker

Vue 3 选择器远程组件包，对外提供两个彼此独立的组件：

- `CategoryPicker`：按 HeyUI CategoryPicker 的结构、数据 API 与交互重新实现。
- `RegionGroupPicker`：省、市、区县、乡镇分组选择器。

```vue
<CategoryPicker v-model="selected" :option="{ datas }" />
```

`option.datas` 支持树结构；组件支持单选、多选、字段映射、路径显示、值回显、异步加载和 `getFullData()`。

区域分组组件使用层级对象作为值：

```vue
<RegionGroupPicker
  v-model="region"
  :option="regionOption"
  separator="-"
/>
```

`region` 的结构为 `{ province, city, area, town }`，实际层级数由数据决定。添加 `inline`
可直接显示核心分组面板；下拉模式会在选择最后一级后触发 `complete` 并自动收起。
