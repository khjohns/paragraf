<script lang="ts">
  import { QueryClientProvider, QueryClient } from '@tanstack/svelte-query';
  import Toast from '$lib/components/Toast.svelte';
  import '../app.css';

  let { children } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
<Toast />
