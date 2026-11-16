<script setup>
const { data } = await useAsyncData('shared', () => $fetch('/api/users'))
</script>
<template>
  <div>{{ data }}</div>
</template>
