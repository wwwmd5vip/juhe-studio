import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface FinanceContextValue {
  selectedUserId: number | null
  openFinanceDrawer: (userId: number) => void
  closeFinanceDrawer: () => void
  isOpen: boolean
}

const FinanceContext = createContext<FinanceContextValue>({
  selectedUserId: null,
  openFinanceDrawer: () => {},
  closeFinanceDrawer: () => {},
  isOpen: false,
})

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openFinanceDrawer = useCallback((userId: number) => {
    setSelectedUserId(userId)
    setIsOpen(true)
  }, [])

  const closeFinanceDrawer = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <FinanceContext.Provider value={useMemo(() => ({ selectedUserId, openFinanceDrawer, closeFinanceDrawer, isOpen }), [selectedUserId, openFinanceDrawer, closeFinanceDrawer, isOpen])}>
      {children}
    </FinanceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFinanceContext() {
  return useContext(FinanceContext)
}
