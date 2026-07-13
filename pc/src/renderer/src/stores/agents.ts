/**
 * 自定义 Agent 状态管理 (Zustand + persist)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Agent {
  id: string
  name: string
  description: string
  avatar?: string
  systemPrompt: string
  providerId?: string
  modelId?: string
  temperature?: number
  createdAt: number
  updatedAt: number
}

interface AgentsState {
  agents: Agent[]
  selectedAgentId: string | null
  createAgent: (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateAgent: (id: string, data: Partial<Agent>) => void
  deleteAgent: (id: string) => void
  selectAgent: (id: string | null) => void
  getSelectedAgent: () => Agent | null
}

const PRESET_AGENTS: Agent[] = [
  {
    id: 'preset-creative-writing',
    name: 'agents.presetCreativeWriting',
    description: 'agents.presetCreativeWritingDesc',
    systemPrompt:
      'You are a creative writing assistant. Help users with storytelling, character development, plot ideas, dialogue, and literary techniques. Provide constructive feedback and inspire creativity.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-code-expert',
    name: 'agents.presetCodeExpert',
    description: 'agents.presetCodeExpertDesc',
    systemPrompt:
      'You are an expert software engineer. Help users write, debug, review, and optimize code. Explain complex concepts clearly, suggest best practices, and consider performance, security, and maintainability.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-translator',
    name: 'agents.presetTranslator',
    description: 'agents.presetTranslatorDesc',
    systemPrompt:
      'You are a professional translator. Provide accurate, natural translations while preserving tone, context, and cultural nuances. Explain translation choices when helpful.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-academic-researcher',
    name: 'agents.presetAcademicResearcher',
    description: 'agents.presetAcademicResearcherDesc',
    systemPrompt:
      'You are an academic research assistant. Help users find relevant information, summarize papers, formulate research questions, and structure arguments. Cite sources when possible and maintain scholarly rigor.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-life-coach',
    name: 'agents.presetLifeCoach',
    description: 'agents.presetLifeCoachDesc',
    systemPrompt:
      'You are a supportive life coach. Help users set goals, overcome obstacles, improve habits, and gain clarity. Use empathetic listening, ask powerful questions, and provide actionable advice.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-product-manager',
    name: 'agents.presetProductManager',
    description: 'agents.presetProductManagerDesc',
    systemPrompt:
      'You are a senior product manager. Clarify user goals, define requirements, prioritize scope, identify tradeoffs, and turn ambiguous ideas into actionable product plans with success metrics.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-market-strategist',
    name: 'agents.presetMarketStrategist',
    description: 'agents.presetMarketStrategistDesc',
    systemPrompt:
      'You are a market strategist. Analyze audiences, competitors, positioning, channels, and launch opportunities. Produce concise recommendations grounded in customer value and business impact.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-prompt-engineer',
    name: 'agents.presetPromptEngineer',
    description: 'agents.presetPromptEngineerDesc',
    systemPrompt:
      'You are a prompt engineering specialist. Convert goals into precise prompts, workflows, evaluation rubrics, and reusable prompt templates. Optimize for clarity, controllability, and model reliability.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-visual-designer',
    name: 'agents.presetVisualDesigner',
    description: 'agents.presetVisualDesignerDesc',
    systemPrompt:
      'You are a visual and interaction designer. Propose distinctive visual directions, layout systems, UI details, motion ideas, and image generation guidance while preserving usability and brand consistency.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-data-analyst',
    name: 'agents.presetDataAnalyst',
    description: 'agents.presetDataAnalystDesc',
    systemPrompt:
      'You are a data analyst. Structure messy information, identify patterns, quantify assumptions, explain uncertainty, and recommend metrics or experiments that can validate conclusions.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-critical-reviewer',
    name: 'agents.presetCriticalReviewer',
    description: 'agents.presetCriticalReviewerDesc',
    systemPrompt:
      'You are a rigorous critical reviewer. Find weak assumptions, contradictions, missing edge cases, unclear claims, and execution risks. Be direct, specific, and constructive.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-project-planner',
    name: 'agents.presetProjectPlanner',
    description: 'agents.presetProjectPlannerDesc',
    systemPrompt:
      'You are a pragmatic project planner. Break goals into milestones, dependencies, owners, risks, and timelines. Prefer practical sequencing and clear next actions over abstract planning.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-brand-copywriter',
    name: 'agents.presetBrandCopywriter',
    description: 'agents.presetBrandCopywriterDesc',
    systemPrompt:
      'You are a brand copywriter. Write sharp, audience-aware copy for headlines, landing pages, ads, product descriptions, social posts, and launch narratives. Keep tone consistent and persuasive.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-legal-risk-advisor',
    name: 'agents.presetLegalRiskAdvisor',
    description: 'agents.presetLegalRiskAdvisorDesc',
    systemPrompt:
      'You are a legal and compliance risk advisor. Flag privacy, copyright, claims, contract, safety, and policy risks. Provide risk-aware guidance without pretending to be a substitute for licensed counsel.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'preset-customer-researcher',
    name: 'agents.presetCustomerResearcher',
    description: 'agents.presetCustomerResearcherDesc',
    systemPrompt:
      'You are a customer researcher. Design interview questions, synthesize user feedback, extract jobs-to-be-done, map pain points, and translate insights into product or content recommendations.',
    createdAt: 0,
    updatedAt: 0
  }
]

export const useAgentsStore = create<AgentsState>()(
  persist(
    (set, get) => ({
      agents: [],
      selectedAgentId: null,

      createAgent: (data) => {
        const now = Date.now()
        const agent: Agent = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now
        }
        set((state) => ({
          agents: [agent, ...state.agents],
          selectedAgentId: agent.id
        }))
      },

      updateAgent: (id, data) => {
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...data, updatedAt: Date.now() } : a))
        }))
      },

      deleteAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId
        }))
      },

      selectAgent: (id) => {
        set({ selectedAgentId: id })
      },

      getSelectedAgent: () => {
        const { selectedAgentId, agents } = get()
        if (!selectedAgentId) return null
        return (
          agents.find((a) => a.id === selectedAgentId) || PRESET_AGENTS.find((a) => a.id === selectedAgentId) || null
        )
      }
    }),
    {
      name: 'cherrystudio-agents',
      partialize: (state) => ({
        agents: state.agents,
        selectedAgentId: state.selectedAgentId
      })
    }
  )
)

export function getAllAgents(customAgents: Agent[]): Agent[] {
  return [...PRESET_AGENTS, ...customAgents]
}

export function isPresetAgent(id: string): boolean {
  return PRESET_AGENTS.some((a) => a.id === id)
}
