import { ErrorCard } from '@/components/ErrorCard'

export default function Forbidden() {
  return <ErrorCard status={403} />
}
