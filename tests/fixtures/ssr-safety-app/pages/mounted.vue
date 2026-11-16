<script setup>
onMounted(() => {
  window.scrollTo(0, 0)
})
onBeforeMount(() => {
  document.title = 'mounted'
})
</script>
<template>
  <div>mounted</div>
</template>
