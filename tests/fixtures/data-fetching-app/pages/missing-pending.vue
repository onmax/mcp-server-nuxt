<script setup>
const { data } = useLazyFetch('/api/users')
</script>
<template>
  <div>{{ data }}</div>
</template>
