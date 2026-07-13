import { client } from './client'

export { client as adminClient }

export interface SystemStatus {
  status: string
  service: string
  version: string
  uptime_seconds: number
  go_version: string
  goroutine_count: number
  memory_mb: number
  db_status: string
}

export interface SchedulerJob {
  name: string
  schedule: string
  last_run: string | null
  next_run: string | null
  last_result: string
  last_error: string
}

export function getSystemStatus() {
  return client.get<SystemStatus, SystemStatus>('/public/status')
}

export function getSchedulerStatus() {
  return client.get<
    { code: number; data: { jobs: SchedulerJob[] } },
    { code: number; data: { jobs: SchedulerJob[] } }
  >('/scheduler/status')
}
