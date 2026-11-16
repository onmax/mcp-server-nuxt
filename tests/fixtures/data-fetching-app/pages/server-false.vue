<script setup>
const { data } = await useFetch('/api/hello', { server: false })
</script>
<template>
  <div>{{ data }}</div>
</template>
