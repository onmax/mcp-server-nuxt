<script setup>
definePageMeta({
  middleware: [
    () => {
      if (!useState('ready').value) return navigateTo('/')
    },
  ],
})
</script>
<template>
  <div>Inline</div>
</template>
