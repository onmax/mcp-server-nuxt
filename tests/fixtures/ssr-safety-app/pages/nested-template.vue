<template>
  <div>
    <template v-if="show">
      <span>{{ window.innerWidth }}</span>
    </template>
    <span>{{ location.href }}</span>
  </div>
</template>

<script setup>
const show = true
</script>
