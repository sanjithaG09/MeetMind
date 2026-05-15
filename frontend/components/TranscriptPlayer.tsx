"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Play, Pause, Volume2, VolumeX, Mic } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { TranscriptData, Segment, AudioFile } from "@/lib/types";

interface Props {
  transcript: TranscriptData;
  fileUrl?: string;
  extraAudioFiles?: AudioFile[];
}

interface RecordingGroup {
  audioIndex: number;
  label: string;
  url: string | undefined;
  segments: Segment[];
  startOffset: number;
}

function getActiveIndex(segments: Segment[], t: number): number {
  if (!segments.length || t < segments[0].start) return -1;
  let lo = 0, hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid].start <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

interface SectionProps {
  group: RecordingGroup;
  onStartPlaying: () => void;
  registerStop: (fn: () => void) => void;
}

function RecordingSection({ group, onStartPlaying, registerStop }: SectionProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevActiveRef = useRef(-1);
  const isDragging = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    registerStop(() => { audioRef.current?.pause(); });
  }, [registerStop]);

  const absoluteTime = currentTime + group.startOffset;
  const activeIndex = getActiveIndex(group.segments, absoluteTime);

  useEffect(() => {
    if (activeIndex >= 0 && activeIndex !== prevActiveRef.current) {
      prevActiveRef.current = activeIndex;
      segmentRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  const seek = useCallback((absoluteSegmentTime: number) => {
    if (!audioRef.current) return;
    const relative = Math.max(0, absoluteSegmentTime - group.startOffset);
    audioRef.current.currentTime = Math.min(relative, audioRef.current.duration || relative);
    onStartPlaying();
    audioRef.current.play();
    setPlaying(true);
  }, [group.startOffset, onStartPlaying]);

  function seekFromClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(group.startOffset + pct * duration);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { onStartPlaying(); audioRef.current.play(); }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="border-t border-gray-200 first:border-t-0">
      <div className="bg-gray-900 px-5 py-3 select-none">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{group.label}</span>
        </div>

        {group.url ? (
          <div className="flex items-center gap-3">
            <audio
              ref={audioRef} src={group.url} muted={muted} preload="metadata"
              onTimeUpdate={() => { if (!isDragging.current) setCurrentTime(audioRef.current?.currentTime ?? 0); }}
              onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white hover:bg-gray-100 active:scale-95 flex items-center justify-center shrink-0 transition-all"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="w-4 h-4 text-gray-900" /> : <Play className="w-4 h-4 text-gray-900 ml-0.5" />}
            </button>
            <span className="text-xs text-gray-400 font-mono tabular-nums w-10 shrink-0">{formatTime(currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-1.5 bg-gray-700 rounded-full cursor-pointer relative group/bar"
              onClick={seekFromClick}
              onMouseDown={(e) => { isDragging.current = true; seekFromClick(e); }}
              onMouseMove={(e) => { if (isDragging.current) seekFromClick(e); }}
              onMouseUp={() => { isDragging.current = false; }}
              onMouseLeave={() => { isDragging.current = false; }}
            >
              <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${pct}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-mono tabular-nums w-10 shrink-0 text-right">{formatTime(duration)}</span>
            <button onClick={() => setMuted((m) => !m)} className="text-gray-500 hover:text-gray-200 transition-colors shrink-0" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No audio file for this recording.</p>
        )}
      </div>

      <div className="divide-y divide-gray-50 bg-white">
        {group.segments.length === 0 && (
          <p className="px-4 py-3 text-xs text-gray-400 italic">Transcript segments not yet linked to this recording. Re-append to update.</p>
        )}
        {group.segments.map((seg, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={i}
              ref={(el) => { segmentRefs.current[i] = el; }}
              className={`flex gap-3 px-4 py-2.5 transition-colors ${isActive ? "bg-gray-100" : "hover:bg-gray-50"}`}
            >
              <button
                onClick={() => seek(seg.start)}
                title={`Jump to ${formatTime(seg.start)}`}
                className={`shrink-0 mt-0.5 w-12 text-right text-xs font-mono tabular-nums transition-colors ${
                  isActive ? "text-gray-900 font-bold" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {formatTime(seg.start - group.startOffset)}
              </button>
              <p className={`text-sm leading-relaxed transition-colors ${isActive ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                {seg.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TranscriptPlayer({ transcript, fileUrl, extraAudioFiles }: Props) {
  const segments = transcript.segments;
  const stopFns = useRef<(() => void)[]>([]);

  const allUrls = useMemo(() => {
    const urls: (string | undefined)[] = [fileUrl];
    (extraAudioFiles ?? []).forEach((af) => urls.push(af.url));
    return urls;
  }, [fileUrl, extraAudioFiles]);

  const allNames = useMemo(() => {
    const names: string[] = ["Recording 1"];
    (extraAudioFiles ?? []).forEach((_, i) => names.push(`Recording ${i + 2}`));
    return names;
  }, [extraAudioFiles]);

  const groups = useMemo((): RecordingGroup[] => {
    const segMap = new Map<number, Segment[]>();
    for (const seg of segments) {
      const idx = seg.audio_index ?? 0;
      if (!segMap.has(idx)) segMap.set(idx, []);
      segMap.get(idx)!.push(seg);
    }
    return allUrls.map((url, idx) => {
      const segs = segMap.get(idx) ?? [];
      return { audioIndex: idx, label: allNames[idx] ?? `Recording ${idx + 1}`, url, segments: segs, startOffset: segs[0]?.start ?? 0 };
    });
  }, [segments, allUrls, allNames]);

  function pauseAll() { stopFns.current.forEach((fn) => fn()); }
  function registerStop(idx: number, fn: () => void) { stopFns.current[idx] = fn; }

  if (!segments.length) {
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {fileUrl && <div className="bg-gray-900 px-5 py-3"><audio controls src={fileUrl} className="w-full" /></div>}
        <div className="p-5 bg-gray-50 max-h-[480px] overflow-y-auto">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{transcript.full_text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[640px] overflow-y-auto">
      {groups.map((group) => (
        <RecordingSection
          key={group.audioIndex}
          group={group}
          onStartPlaying={pauseAll}
          registerStop={(fn) => registerStop(group.audioIndex, fn)}
        />
      ))}
    </div>
  );
}
