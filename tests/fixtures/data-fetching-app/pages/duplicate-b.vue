<script setup>
const { data } = await useAsyncData('profile', () => $fetch('/api/org'))
</script>
<template>
  <div>{{ data }}</div>
</template>
