import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { DbModel } from '@shared/types/provider'
import type { Project, Deliverable } from '@shared/types/creator-os'

const creatorOsApi = (window as any).api?.creatorOs
const dbApi = (window as any).api?.db

function getCreatorOsApi() {
  const api = (window as any).api?.creatorOs
  if (!api) throw new Error('Creator OS API not available')
  return api
}

function getDbApi() {
  const api = (window as any).api?.db
  if (!api) throw new Error('DB API not available')
  return api
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['creator-os', 'projects'],
    queryFn: () => getCreatorOsApi().listProjects()
  })
}

export function useProject(projectId: string) {
  return useQuery<Project>({
    queryKey: ['creator-os', 'projects', projectId],
    queryFn: () => getCreatorOsApi().getProject(projectId),
    enabled: !!projectId
  })
}

export function useProjectAssets(projectId: string) {
  return useQuery({
    queryKey: ['creator-os', 'assets', projectId],
    queryFn: () => getCreatorOsApi().listAssets(projectId),
    enabled: !!projectId
  })
}

export function useProjectDeliverables(projectId: string, options?: { refetchInterval?: number }) {
  return useQuery<Deliverable[]>({
    queryKey: ['creator-os', 'deliverables', projectId],
    queryFn: () => getCreatorOsApi().listDeliverables(projectId),
    enabled: !!projectId,
    refetchInterval: options?.refetchInterval ?? false
  })
}

export function useImageModels() {
  return useQuery<DbModel[]>({
    queryKey: ['db', 'models', 'image'],
    queryFn: () => getDbApi().models.list({ type: 'image' }),
    staleTime: 60_000
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; category?: string }) =>
      getCreatorOsApi().createProject({ category: 'product_set', ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects'] })
    }
  })
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => getCreatorOsApi().updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects'] })
    }
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => getCreatorOsApi().deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects'] })
    }
  })
}

export function useSubmitProductSet(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slotParams: Record<string, unknown>) =>
      getCreatorOsApi().submitProductSetWithParams(projectId, slotParams),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'deliverables', projectId] })
    }
  })
}

export function useRetryProductSet(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskIds: string[]) => getCreatorOsApi().retryProductSet(projectId, taskIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'deliverables', projectId] })
    }
  })
}

export function useCancelProductSet(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => getCreatorOsApi().cancelProductSet(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'deliverables', projectId] })
    }
  })
}
