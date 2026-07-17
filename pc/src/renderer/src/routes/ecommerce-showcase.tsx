import { createFileRoute } from '@tanstack/react-router'
import { EcommerceShowcasePage } from '@/components/ecommerce-showcase/EcommerceShowcasePage'

export const Route = createFileRoute('/ecommerce-showcase')({
  component: EcommerceShowcasePage
})
