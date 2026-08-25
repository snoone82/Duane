"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/** Minimal typings for the Web Speech API — not in TypeScript's dom lib. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Duane's ask: dictate into the AI chat. Uses the browser's built-in
 * speech recognition (Chrome, Edge, Safari — the button simply doesn't
 * render where it's unsupported). Final phrases are appended to the input
 * as they're recognised; tap again to stop. */
export function DictationButton({ onText, disabled = false }: { onText: (text: string) => void; disabled?: boolean }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setIsSupported(getRecognitionCtor() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  if (!isSupported) return null;

  function toggle() {
    setError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal && result[0]) onText(result[0].transcript.trim());
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") setError("Microphone access was blocked — allow it in your browser settings.");
      else if (event.error !== "aborted" && event.error !== "no-speech") setError("Dictation stopped — try again.");
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant={isListening ? "primary" : "secondary"}
        size="sm"
        disabled={disabled}
        onClick={toggle}
        aria-pressed={isListening}
        aria-label={isListening ? "Stop dictating" : "Dictate your question"}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <rect x="4" y="1" width="4" height="6.5" rx="2" />
          <path d="M2 6a4 4 0 0 0 8 0h-1a3 3 0 0 1-6 0H2z" />
          <rect x="5.5" y="9.5" width="1" height="1.5" />
        </svg>
        {isListening ? "Listening… tap to stop" : "Dictate"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
