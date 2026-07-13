import type { FC, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

let onPop = () => {}
let onShow = ({ element, id }: { element: FC | ReactNode; id: string }) => {
  void element
  void id
}
let onHide = (id: string) => {
  void id
}
let onHideAll = () => {}

interface Props {
  children?: ReactNode
}

type ElementItem = {
  id: string
  element: FC | ReactNode
}

// Static container component - defined outside render to avoid re-creation
const FullScreenContainer: FC<{ children: ReactNode; onPop: () => void }> = ({ children, onPop }) => {
  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/40' onClick={onPop} />
      {children}
    </div>
  )
}

const TopViewContent: FC<Props> = ({ children }) => {
  const [elements, setElements] = useState<ElementItem[]>([])
  const elementsRef = useRef<ElementItem[]>([])
  elementsRef.current = elements

  onPop = () => {
    const views = [...elementsRef.current]
    views.pop()
    elementsRef.current = views
    setElements(elementsRef.current)
  }

  onShow = ({ element, id }: ElementItem) => {
    if (!elementsRef.current.find((el) => el.id === id)) {
      elementsRef.current = elementsRef.current.concat([{ element, id }])
      setElements(elementsRef.current)
    }
  }

  onHide = (id: string) => {
    elementsRef.current = elementsRef.current.filter((el) => el.id !== id)
    setElements(elementsRef.current)
  }

  onHideAll = () => {
    setElements([])
    elementsRef.current = []
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onPop()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <>
      {children}
      {elements.map(({ element: Element, id }) => (
        <FullScreenContainer key={`TOPVIEW_${id}`} onPop={onPop}>
          {typeof Element === 'function' ? <Element /> : Element}
        </FullScreenContainer>
      ))}
    </>
  )
}

export const TopView = {
  show: (element: FC | ReactNode, id: string) => onShow({ element, id }),
  hide: (id: string) => onHide(id),
  clear: () => onHideAll(),
  pop: () => onPop()
}

export default TopViewContent
