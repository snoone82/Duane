import type { TextareaHTMLAttributes } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  optional?: boolean;
}

export function TextAreaField({ label, optional, id, className = "", ...props }: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-ink-soft">
        {label}
        {optional && <span className="text-ink-faint"> (optional)</span>}
      </label>
      <textarea
        id={id}
        rows={3}
        className={`w-full rounded-md border border-border bg-paper-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-gold ${className}`}
        {...props}
      />
    </div>
  );
}
