type Kind = "info" | "success" | "danger";

const kindClass: Record<Kind, string> = {
  info: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
};

export function Notice({ kind = "info", children }: { kind?: Kind; children: React.ReactNode }) {
  return (
    <div role={kind === "danger" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${kindClass[kind]}`}>
      {children}
    </div>
  );
}
