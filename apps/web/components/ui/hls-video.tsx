"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

interface HlsVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  poster?: string;
}

/**
 * Plays an HLS (.m3u8) source. Uses native playback on Safari and
 * hls.js on Chrome/Firefox/Edge.
 */
export function HlsVideo({ src, poster, ...rest }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    // Last-resort fallback (older browser): set src directly. May not play.
    video.src = src;
  }, [src]);

  return <video ref={videoRef} poster={poster} {...rest} />;
}
