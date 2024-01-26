import { useHttp } from '@/plugins/http'
import { useAuthStore } from '@/stores/auth'
import type { ResponseType, AxiosResponse, AxiosRequestConfig } from 'axios'
import { AuthenticationError, PermissionError, APIServerError, RequestError } from '@/composables/HTTPErrors'
import { resolveTransitionHooks } from 'vue'

interface loginIdents {
  user: string
  password: string
}

export interface ClusterDescription {
  name: string
  permissions: ClusterPermissions
  stats?: ClusterStats
}

interface ClusterPermissions {
  roles: string[]
  actions: string[]
}

export interface UserDescription {
  login: string
  fullname: string
}

export interface AccountDescription {
  name: string
}

interface GatewayLoginResponse extends UserDescription {
  token: string
  groups: string[]
}

export class ClusterStats {
  resources: {
    nodes: number
    cores: number
  }
  jobs: {
    running: number
    total: number
  }
  constructor() {
    this.resources = { nodes: 0, cores: 0 }
    this.jobs = { running: 0, total: 0 }
  }
}

export interface ClusterJob {
  job_id: number
  user_name: string
  account: string
  job_state: string
  state_reason: string
  partition: string
  qos: string
}

export interface ClusterJobTRES {
  count: number
  id: number
  name: string
  type: string
}

export interface ClusterOptionalNumber {
  infinite: boolean
  number: number
  set: boolean
}

export interface ClusterPreciseTime {
  seconds: number
  microseconds: number
}

export interface ClusterJobTime {
  elapsed: number
  eligible: number
  end: number
  limit: ClusterOptionalNumber
  start: number
  submission: number
  suspended: number
  system: ClusterPreciseTime
  total: ClusterPreciseTime
  user: ClusterPreciseTime
}

export interface ClusterJobStep {
  step: { id: { job_id: number; step_id: string }; name: string }
}

export interface ClusterJobExitCode {
  return_code: number
  status: string
}

export interface ClusterIndividualJob {
  accrue_time: number
  association: { account: string; cluster: string; partition: string; user: string }
  batch_flag: boolean
  command: string
  comment: { administrator: string; job: string; system: string }
  cpus: ClusterOptionalNumber
  current_working_directory: string
  derived_exit_code: ClusterJobExitCode
  exclusive: string[]
  exit_code: ClusterJobExitCode
  group: string
  last_sched_evaluation: number
  name: string
  node_count: ClusterOptionalNumber
  nodes: string
  partition: string
  priority: ClusterOptionalNumber
  qos: string
  script: string
  standard_error: string
  standard_input: string
  standard_output: string
  state: { current: string; reason: string }
  steps: ClusterJobStep[]
  submit_line: string
  tasks: ClusterOptionalNumber
  time: ClusterJobTime
  tres: { allocated: ClusterJobTRES[]; requested: ClusterJobTRES[] }
  tres_req_str: string
  used_gres: string
  user: string
  wckey: { flags: string[]; wckey: string }
  working_directory: string
}

export interface ClusterNode {
  name: string
  cores: number
  cpus: number
  real_memory: number
  state: Array<string>
  partitions: Array<string>
}

export interface ClusterQos {
  name: string
  description: string
}

export type RacksDBAPIImage = ImageBitmapSource
export type RacksDBAPIResult = RacksDBAPIImage

export type GatewayAPIKey = 'stats' | 'jobs' | 'job' | 'nodes' | 'qos' | 'accounts'

export function useGatewayAPI() {
  const http = useHttp()
  const authStore = useAuthStore()
  let controller = new AbortController()

  function requestConfig(withToken: boolean = true, responseType: ResponseType = "json"): AxiosRequestConfig {
    let config: AxiosRequestConfig = {
      responseType: responseType,
      signal: controller.signal
    }
    if (withToken === true) {
      config.headers = { Authorization: `Bearer ${authStore.token}` }
    }
    return config
  }

  async function requestServer(func: Function): Promise<AxiosResponse> {
    try {
      return await func()
    } catch (error: any) {
      if (error.response) {
        /* Server replied with error status code */
        if (error.response.status == 401) {
          throw new AuthenticationError(error.message)
        } else if (error.response.status == 403) {
          throw new PermissionError(error.message)
        } else {
          throw new APIServerError(error.response.status, error.response.data.description)
        }
      } else if (error.request) {
        /* No reply from server */
        throw new RequestError(`Request error: ${error.message}`)
      } else {
        /* Something else happening when setting up the request */
        throw new RequestError(`Setting up request error: ${error.message}`)
      }
    }
  }

  async function get<CType>(resource: string, withToken: boolean = true, responseType: ResponseType = "json"): Promise<CType> {
    console.log(`Slurm-web gateway API get ${resource}`)
    return (
      await requestServer(() => {
        return http.get(resource, requestConfig(withToken, responseType))
      })
    ).data as CType
  }

  async function post<CType>(resource: string, data: any, withToken: boolean = true, responseType: ResponseType = "json"): Promise<CType> {
    console.log(`Slurm-web gateway API post ${resource}`)
    return (
      await requestServer(() => {
        return http.post(resource, data, requestConfig(withToken, responseType))
      })
    ).data as CType
  }

  async function login(idents: loginIdents): Promise<GatewayLoginResponse> {
    try {
      return (await post('/login', idents)) as GatewayLoginResponse
    } catch (error: any) {
      /* Translate 401 APIServerError into AuthenticationError */
      if (error instanceof APIServerError && error.status == 401) {
        throw new AuthenticationError(error.message)
      }
      throw error
    }
  }

  async function clusters(): Promise<Array<ClusterDescription>> {
    return await get<ClusterDescription[]>(`/clusters`)
  }

  async function users(): Promise<Array<UserDescription>> {
    return await get<UserDescription[]>(`/users`)
  }

  async function stats(cluster: string): Promise<ClusterStats> {
    return await get<ClusterStats>(`/agents/${cluster}/stats`)
  }

  async function jobs(cluster: string): Promise<ClusterJob[]> {
    return await get<ClusterJob[]>(`/agents/${cluster}/jobs`)
  }

  async function job(cluster: string, job: number): Promise<ClusterJob> {
    return await get<ClusterJob>(`/agents/${cluster}/job/${job}`)
  }

  async function nodes(cluster: string): Promise<ClusterNode[]> {
    return await get<ClusterNode[]>(`/agents/${cluster}/nodes`)
  }

  async function qos(cluster: string): Promise<ClusterQos[]> {
    return await get<ClusterQos[]>(`/agents/${cluster}/qos`)
  }

  async function accounts(cluster: string): Promise<Array<AccountDescription>> {
    return await get<AccountDescription[]>(`/agents/${cluster}/accounts`)
  }

  async function infrastructureImagePng(cluster: string): Promise<RacksDBAPIImage> {
    return new Blob([
      await post<ArrayBuffer>(`/agents/${cluster}/racksdb/draw/infrastructure/${cluster}.png`, {}, false, "arraybuffer")
    ]) as RacksDBAPIImage
  }

  function abort() {
    /* Abort all pending requests */
    console.log('Aborting requests')
    controller.abort()
    controller = new AbortController()
  }

  return { login, clusters, users, stats, jobs, job, nodes, qos, accounts, infrastructureImagePng, abort }
}
