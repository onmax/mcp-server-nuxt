<script setup>
const { $api: apiClient } = useNuxtApp()
</script>

<template>
  <div v-for="$api in items">{{ $api }}</div>
</template>
