<script setup>
function handleClick() {
  window.open('https://example.com')
}

const onScroll = () => {
  document.body.classList.add('scrolled')
}
</script>
<template>
  <button @click="handleClick">go</button>
</template>
