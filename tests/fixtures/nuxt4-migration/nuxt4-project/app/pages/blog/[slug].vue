<script setup>
const route = useRoute()
const slug = route.params.slug
const { data } = await useAsyncData(`post-${slug}`, () => $fetch(`/api/posts/${slug}`))
</script>
<template>
  <div>{{ data }}</div>
</template>
