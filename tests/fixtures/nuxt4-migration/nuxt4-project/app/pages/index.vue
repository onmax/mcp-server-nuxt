<script setup>
const { data, error, status } = await useAsyncData('home', () => $fetch('/api/home'))
</script>
<template>
  <div v-if="status === 'pending'">Loading</div>
  <div v-else-if="error">Error</div>
  <div v-else>{{ data }}</div>
</template>
