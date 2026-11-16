<script setup>
const { data } = await useAsyncData('users', () => $fetch('/api/users'), { deep: false })
</script>
<template>
  <div>{{ data }}</div>
</template>
