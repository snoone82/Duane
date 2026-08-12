type Tone = "info" | "error" | "success";

const tones: Record<Tone, string> = {
  info: "bg-info-bg text-info border-info",
  error: "bg-error-bg text-error border-error",
  success: "bg-success-bg text-success border-success",
};

export function Notice({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-sm leading-snug ${tones[tone]}`}
    >
      {children}
    </div>
  );
}
