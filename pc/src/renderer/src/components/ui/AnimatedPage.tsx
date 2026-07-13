import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedPageProps {
  children: ReactNode
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 6
  },
  animate: {
    opacity: 1,
    y: 0
  }
}

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.15
}

export function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      initial='initial'
      animate='animate'
      variants={pageVariants}
      transition={pageTransition}
      className='h-full'
    >
      {children}
    </motion.div>
  )
}

// Stagger container for lists
interface StaggerContainerProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
}

export function StaggerContainer({ children, className, staggerDelay = 0.05 }: StaggerContainerProps) {
  return (
    <motion.div
      initial='hidden'
      animate='visible'
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Stagger item for lists
interface StaggerItemProps {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 }
      }}
      transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Fade in wrapper
interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
}

export function FadeIn({ children, className, delay = 0, duration = 0.3 }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Scale on hover
interface ScaleOnHoverProps {
  children: ReactNode
  className?: string
  scale?: number
}

export function ScaleOnHover({ children, className, scale = 1.02 }: ScaleOnHoverProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Slide in from side
interface SlideInProps {
  children: ReactNode
  className?: string
  direction?: 'left' | 'right' | 'top' | 'bottom'
  delay?: number
}

export function SlideIn({ children, className, direction = 'left', delay = 0 }: SlideInProps) {
  const directions = {
    left: { x: -20, y: 0 },
    right: { x: 20, y: 0 },
    top: { x: 0, y: -20 },
    bottom: { x: 0, y: 20 }
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay, type: 'tween', ease: 'easeOut', duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Animated number counter
interface AnimatedCounterProps {
  value: number
  className?: string
  duration?: number
}

export function AnimatedCounter({ value, className, duration = 0.5 }: AnimatedCounterProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration }}
      className={className}
    >
      {value}
    </motion.span>
  )
}

// Skeleton loading animation
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={`bg-[var(--juhe-surface-2)] rounded animate-pulse ${className}`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
    />
  )
}

// Modal/Dialog animation wrapper
interface ModalAnimationProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
}

export function ModalAnimation({ children, isOpen, onClose }: ModalAnimationProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
