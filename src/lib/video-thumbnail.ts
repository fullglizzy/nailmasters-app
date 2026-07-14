/**
 * Генерирует thumbnail (data URL) из первого кадра видео.
 * Используется для превью видео в сетке создания дизайна.
 */
export function captureVideoFrame(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
    };

    const onLoaded = () => {
      cleanup();
      // Seek to 25% to avoid black opening frames
      video.currentTime = Math.min(1, video.duration * 0.25);
    };

    const onError = () => { cleanup(); resolve(null); };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('error', onError);

    video.addEventListener('seeked', () => {
      cleanup();
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        resolve(null);
      }
    }, { once: true });

    video.src = url;
    video.load();
  });
}
