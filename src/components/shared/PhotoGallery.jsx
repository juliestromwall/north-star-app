import { useState } from 'react'
import { Camera } from 'lucide-react'

export default function PhotoGallery({ photos = [], mode = 'hero' }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (!photos.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 border-2 border-dashed border-border py-12">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Camera className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No photos yet</p>
        <p className="text-xs text-muted-foreground mt-1">Photos will appear here once added</p>
      </div>
    )
  }

  if (mode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Photo ${i + 1}`}
            className="w-full h-32 object-cover rounded-lg"
          />
        ))}
      </div>
    )
  }

  // Hero mode (for share pages)
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl">
        <img
          src={photos[activeIndex]}
          alt="Profile photo"
          className="w-full h-64 sm:h-80 object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 justify-center">
          {photos.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`overflow-hidden rounded-lg border-2 transition-colors ${
                i === activeIndex ? 'border-abc-indigo' : 'border-transparent hover:border-border'
              }`}
            >
              <img
                src={src}
                alt={`Thumbnail ${i + 1}`}
                className="w-16 h-16 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
