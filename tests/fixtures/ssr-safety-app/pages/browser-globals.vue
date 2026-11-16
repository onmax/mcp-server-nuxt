<script setup>
const width = window.innerWidth
const doc = document.title
const stored = localStorage.getItem('theme')
const session = sessionStorage.getItem('theme')
const lang = navigator.language
const href = location.href
</script>
<template>
  <div>{{ width }} {{ doc }} {{ stored }} {{ session }} {{ lang }} {{ href }}</div>
</template>
