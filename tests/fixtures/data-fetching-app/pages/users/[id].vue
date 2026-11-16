<script setup>
const route = useRoute()
const { data } = await useFetch(`/api/users/${route.params.id}`)
</script>
<template>
  <div>{{ data }}</div>
</template>
