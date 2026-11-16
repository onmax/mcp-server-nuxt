<script setup>
const data = await $fetch('/api/hello')
</script>
<template>
  <pre>{{ data }}</pre>
</template>
