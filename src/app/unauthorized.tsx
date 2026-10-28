import { ErrorCard } from '@/components/ErrorCard'

export default function Unauthorized() {
  return <ErrorCard status={401} />
}
