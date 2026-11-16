<script setup>
const loaded = ref(false)
onMounted(async () => {
  loaded.value = await $fetch('/api/health')
})
</script>
<template>
  <div>
    <slot />
  </div>
</template>
