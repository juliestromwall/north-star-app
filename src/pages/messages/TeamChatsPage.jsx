import { MessageCircle } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'

export default function TeamChatsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Team Chats" />
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <MessageCircle className="size-12 text-stone-300 mb-4" />
        <h3 className="text-lg font-semibold text-stone-600">Coming soon</h3>
        <p className="text-sm text-stone-400 mt-1">
          Group messaging with your team
        </p>
      </div>
    </div>
  )
}
