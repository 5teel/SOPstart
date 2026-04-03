'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  const ffmpeg = new FFmpeg()
  // Load WASM from /public/ffmpeg/ — same origin, no CORS issues
  // Single-thread mode (no SharedArrayBuffer/COEP needed) — simpler v1
  await ffmpeg.load({
    coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  const ffmpeg = await getFFmpeg()

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100))
  })

  const ext = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4'
  const inputName = `input.${ext}`

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile))

  await ffmpeg.exec([
    '-i', inputName,
    '-vn',                    // strip video track
    '-acodec', 'libmp3lame',  // MP3 codec
    '-q:a', '4',              // VBR quality (~165kbps, good for speech)
    '-ac', '1',               // mono (speech — halves file size)
    'audio.mp3',
  ])

  const data = await ffmpeg.readFile('audio.mp3')

  // Clean up WASM filesystem
  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile('audio.mp3')

  // Cast to Uint8Array for File constructor (FFmpeg returns Uint8Array | string)
  const buffer = data as Uint8Array
  return new File([buffer.buffer as ArrayBuffer], 'audio.mp3', { type: 'audio/mpeg' })
}
