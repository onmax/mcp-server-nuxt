<script setup>
const props = defineProps({ error: Object })
const data = JSON.parse(props.error.data)
</script>
<template>
  <div>{{ data }}</div>
</template>
