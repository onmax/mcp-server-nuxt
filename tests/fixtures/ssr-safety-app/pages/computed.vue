<script setup>
const width = computed(() => window.innerWidth)
const id = computed(() => crypto.randomUUID())
</script>
<template>
  <div>{{ width }} {{ id }}</div>
</template>
