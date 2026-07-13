import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/product-composition')({
  component: () => <Navigate to='/ecommerce' replace />
})
