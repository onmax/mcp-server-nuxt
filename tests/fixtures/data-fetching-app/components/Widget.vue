<script setup>
const props = defineProps({ id: { type: String, required: true } })
const { data, error, pending } = await useFetch(`/api/widgets/${props.id}`, {
  key: 'widgets',
  lazy: true,
})
</script>
<template>
  <div v-if="pending">Loading</div>
  <div v-else-if="error">Error</div>
  <div v-else>{{ data }}</div>
</template>
