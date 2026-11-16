<script setup>
const { data } = await useFetch('/api/summary')
</script>
<template>
  <div>{{ data }}</div>
  <NuxtPage />
</template>
