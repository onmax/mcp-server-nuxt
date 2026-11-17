<script setup>
const { $api } = useNuxtApp()
const app = useNuxtApp()
app.$api('/users')
useNuxtApp().$formatPrice(12)
</script>

<template>
  <div>{{ $formatPrice(price) }}</div>
  <button @click="$toast('Saved')">Save</button>
  <span>{{ user.$api }}</span>
  <div>{{ $t('hello') }}</div>
  <div>{{ $route.path }}</div>
</template>
