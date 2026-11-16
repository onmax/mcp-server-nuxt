<script setup>
const users = ref([])
onMounted(async () => {
  users.value = await $fetch('/api/users')
})
</script>
<template>
  <ul>
    <li v-for="user in users" :key="user.id">{{ user.name }}</li>
  </ul>
</template>
