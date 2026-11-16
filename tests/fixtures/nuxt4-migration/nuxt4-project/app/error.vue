<script setup>
const props = defineProps({ error: Object })
const data = props.error.data
</script>
<template>
  <div>{{ data }}</div>
</template>
