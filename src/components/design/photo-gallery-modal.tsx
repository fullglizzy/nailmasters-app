'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoGalleryModalProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function PhotoGalleryModal({ images, initialIndex = 0, onClose }: PhotoGalleryModalProps) {
  const [current, setCurrent] = useState(initialIndex);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrent((p: number) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setCurrent((p: number) => Math.min(images.length - 1, p + 1));
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, images.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
        <X className="h-6 w-6" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setCurrent((p: number) => Math.max(0, p - 1)); }}
        disabled={current === 0}
        className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 disabled:opacity-30"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <div className="relative w-[90vw] h-[90vh] flex items-center justify-center">
        <Image
          src={images[current]}
          alt={`${current + 1}/${images.length}`}
          fill
          sizes="90vw"
          className="object-contain"
          onClick={(e) => e.stopPropagation()}
          priority
        />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setCurrent((p: number) => Math.min(images.length - 1, p + 1)); }}
        disabled={current === images.length - 1}
        className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 disabled:opacity-30"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {current + 1} / {images.length}
      </div>

      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
        {images.slice(0, 10).map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
            className={`w-2 h-2 rounded-full ${i === current ? 'bg-white' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}