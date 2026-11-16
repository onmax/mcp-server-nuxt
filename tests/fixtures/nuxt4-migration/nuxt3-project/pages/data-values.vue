<script setup>
const { data, error } = await useFetch('/api/values')
if (data.value === null) {
  console.log('no data')
}
if (error.value === null) {
  console.log('no error')
}
data.value.title = 'updated'
data.value.items.push({ id: 1 })
</script>
<template>
  <div>{{ data }}</div>
</template>
