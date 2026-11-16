<script setup>
const { data } = await useAsyncData('cache', () => $fetch('/api/cache'), {
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
})
</script>
<template>
  <div>{{ data }}</div>
</template>
