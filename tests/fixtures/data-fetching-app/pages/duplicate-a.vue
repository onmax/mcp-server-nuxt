<script setup>
const { data } = await useFetch('/api/user', { key: 'profile', lazy: true })
</script>
<template>
  <div>{{ data }}</div>
</template>
