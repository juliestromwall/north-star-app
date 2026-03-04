import { Upload, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export default function AddPhotosDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ImagePlus className="size-3.5" /> Add Photos
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 px-6 text-center">
          <div className="size-12 rounded-full bg-abc-indigo/10 flex items-center justify-center mb-3">
            <Upload className="size-5 text-abc-indigo" />
          </div>
          <p className="text-sm font-medium">Drag photos here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB each</p>
          <Button variant="outline" size="sm" className="mt-4">
            Browse Files
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Photo upload is a mock feature for this prototype.
        </p>
      </DialogContent>
    </Dialog>
  )
}
