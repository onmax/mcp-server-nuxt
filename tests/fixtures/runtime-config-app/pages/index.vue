<script setup>
const { public: { appName }, apiSecret = '' } = useRuntimeConfig()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase
</script>
<template>
  <div>{{ appName }} {{ apiBase }}</div>
</template>
