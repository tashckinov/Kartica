<template>
  <nav class="bottom-nav" role="navigation" aria-label="Основное меню">
    <div class="nav-items">
      <button
        v-for="item in items"
        :key="item.id"
        class="nav-button"
        type="button"
        :data-nav="item.id"
        :aria-pressed="item.id === active ? 'true' : 'false'"
        :class="{ active: item.id === active }"
        @click="onSelect(item.id)"
      >
        <span class="nav-icon" aria-hidden="true" v-html="item.icon"></span>
        <span>{{ item.label }}</span>
        <span class="nav-indicator"></span>
      </button>
    </div>
  </nav>
</template>

<script setup>
const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  active: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['change']);

const onSelect = (id) => {
  if (id === props.active) return;
  emit('change', id);
};
</script>
