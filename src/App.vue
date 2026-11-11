<template>
  <main class="picker-playground">
    <h1>CategoryPicker</h1>
    <p>通过 comps-vue3-picker 提供的分类选择器。</p>
    <CategoryPicker v-model="value" :option="{ datas }" />
    <pre>{{ value }}</pre>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CategoryPicker from './components/CategoryPicker.vue'

const value = ref('hangzhou')
const datas = [{ key: 'zhejiang', title: '浙江省', children: [{ key: 'hangzhou', title: '杭州市' }] }]
</script>
