<script setup>
const { data } = await useAsyncData('users', () => $fetch('/api/users'), { deep: true })
</script>
<template>
  <div>{{ data }}</div>
</template>
