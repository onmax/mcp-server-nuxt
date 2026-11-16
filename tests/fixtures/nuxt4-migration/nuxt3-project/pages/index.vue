<script setup>
import { useHead } from '@unhead/vue'

const route = useRoute()
useHead({
  meta: [{ name: 'description', vmid: 'description', hid: 'description' }],
})
console.log(route.meta.name)
console.log(window.__NUXT__)
</script>
<template>
  <div>Home</div>
</template>
