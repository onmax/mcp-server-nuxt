<script setup>
const { data: users, pending } = useLazyFetch('/api/users')
</script>
<template>
  <div v-if="pending">Loading</div>
  <div v-else>{{ users }}</div>
</template>
