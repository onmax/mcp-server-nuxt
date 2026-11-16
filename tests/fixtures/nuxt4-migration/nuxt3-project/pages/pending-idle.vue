<script setup>
const { data, pending } = await useFetch('/api/idle', { immediate: false })
</script>
<template>
  <div v-if="!pending">{{ data }}</div>
</template>
