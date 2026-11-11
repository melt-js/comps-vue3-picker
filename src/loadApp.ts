import { isMasterApp } from 'hel-iso'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

if (isMasterApp()) createApp(App).mount('#app')
