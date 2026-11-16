<script setup>
const auth = useAuth()
</script>
<template>
  <div>
    <BaseButton label="Home" />
    <UserCard name="Ada" />
    <LazyUserCard name="Grace" />
    <user-card name="Lin" />
  </div>
</template>
