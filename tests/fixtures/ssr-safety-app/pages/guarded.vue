<script setup>
if (import.meta.client) {
  window.clientOnly()
}
if (process.client) {
  window.processClient()
}
if (typeof window !== 'undefined') {
  window.guarded()
}
const hasWindow = typeof window !== 'undefined'
</script>
<template>
  <div>{{ hasWindow }}</div>
</template>
