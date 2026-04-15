import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ open, onOpenChange, title = 'Are you sure?', message = 'This action cannot be undone.', confirmLabel = 'Delete', onConfirm, destructive = true }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`size-5 ${destructive ? 'text-red-500' : 'text-amber-500'}`} />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-stone-500">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} size="sm" onClick={() => { onConfirm(); onOpenChange(false) }}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
