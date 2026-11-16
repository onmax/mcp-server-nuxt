<script setup>
const { public: pub } = useRuntimeConfig()
const { featureFlag } = useRuntimeConfig().public
</script>
<template>
  <div>{{ pub.appName }} {{ featureFlag }}</div>
</template>
