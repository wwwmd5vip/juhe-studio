import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// ==================== Generations ====================
export function useGenerations(filter?: { type?: string; status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['generations', filter],
    queryFn: async () => {
      return window.api?.db?.generations?.list(filter) ?? []
    }
  })
}

export function useGeneration(id: string) {
  return useQuery({
    queryKey: ['generations', id],
    queryFn: async () => {
      return window.api?.db?.generations?.get(id) ?? null
    },
    enabled: !!id
  })
}

export function useCreateGeneration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return window.api?.db?.generations?.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    }
  })
}

export function useUpdateGeneration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return window.api?.db?.generations?.update(id, data)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['generations'] })
      queryClient.invalidateQueries({ queryKey: ['generations', vars.id] })
    }
  })
}

export function useDeleteGeneration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return window.api?.db?.generations?.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generations'] })
    }
  })
}

// ==================== Workflows ====================
export function useWorkflows(filter?: { isFavorite?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['workflows', filter],
    queryFn: async () => {
      return window.api?.db?.workflows?.list(filter) ?? []
    }
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return window.api?.db?.workflows?.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    }
  })
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return window.api?.db?.workflows?.update(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    }
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return window.api?.db?.workflows?.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    }
  })
}

// ==================== Prompt Templates ====================
export function usePromptTemplates(filter?: { category?: string; search?: string; isFavorite?: boolean }) {
  return useQuery({
    queryKey: ['promptTemplates', filter],
    queryFn: async () => {
      return window.api?.db?.promptTemplates?.list(filter) ?? []
    }
  })
}

export function useCreatePromptTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return window.api?.db?.promptTemplates?.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promptTemplates'] })
    }
  })
}

export function useUpdatePromptTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return window.api?.db?.promptTemplates?.update(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promptTemplates'] })
    }
  })
}

export function useDeletePromptTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return window.api?.db?.promptTemplates?.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promptTemplates'] })
    }
  })
}

// ==================== Providers ====================
export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      return window.api?.db?.providers?.list() ?? []
    }
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return window.api?.db?.providers?.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    }
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return window.api?.db?.providers?.update(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    }
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return window.api?.db?.providers?.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    }
  })
}

// ==================== Models ====================
export function useModels(filter?: { providerId?: string; type?: string }) {
  return useQuery({
    queryKey: ['models', filter],
    queryFn: async () => {
      return window.api?.db?.models?.list(filter) ?? []
    }
  })
}

// ==================== Settings ====================
export function useSetting(key: string) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: async () => {
      return window.api?.db?.settings?.get(key)
    },
    enabled: !!key
  })
}

export function useSetSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return window.api?.db?.settings?.set(key, value)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['settings', vars.key] })
    }
  })
}
