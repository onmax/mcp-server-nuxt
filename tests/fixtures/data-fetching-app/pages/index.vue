<script setup>
const id = ref(1)
const { data: users, pending, status } = await useFetch('/api/users', {
  method: 'GET',
  lazy: true,
  server: false,
  immediate: true,
  watch: [id],
  pick: ['id', 'name'],
  transform: (rows) => rows,
  default: () => [],
})
const detail = await useLazyFetch('/api/detail', { key: 'detail-key', server: false })
</script>
<template>
  <div v-if="pending || status === 'pending'">Loading</div>
  <div v-else>{{ users }}</div>
  <div v-if="detail.pending">Loading detail</div>
  <div v-else>{{ detail.data }}</div>
</template>
