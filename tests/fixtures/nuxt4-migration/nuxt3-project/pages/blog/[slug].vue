<script setup>
const route = useRoute()
const { data } = await useAsyncData(async () => $fetch(`/api/posts/${route.params.slug}`))
</script>
<template>
  <div>{{ data }}</div>
</template>
