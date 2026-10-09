"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock3, X } from "lucide-react";

import { cn } from "@/lib/utils";

type TimePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return { hour: "9", minute: "00", meridiem: "AM" as const };
  }

  const hour24 = Number(match[1]);
  return {
    hour: String(hour24 % 12 || 12),
    minute: match[2],
    meridiem: hour24 >= 12 ? ("PM" as const) : ("AM" as const),
  };
}

function toTimeValue(hour: string, minute: string, meridiem: "AM" | "PM") {
  const hour12 = Number(hour) % 12;
  const hour24 = hour12 + (meridiem === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function formatTime(value: string) {
  if (!value) {
    return "Choose a time";
  }

  const { hour, minute, meridiem } = parseTime(value);
  return `${hour}:${minute} ${meridiem}`;
}

export function TimePicker({ id, label, value, onChange, error }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ left: 0, width: 0 });
  const [draft, setDraft] = useState(() => parseTime(value));
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function updateDraft(next: Partial<typeof draft>) {
    const nextDraft = { ...draft, ...next };
    setDraft(nextDraft);
    onChange(toTimeValue(nextDraft.hour, nextDraft.minute, nextDraft.meridiem));
  }

  return (
    <div ref={pickerRef} className="relative space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <button
        id={`${id}-picker`}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "group flex h-12 w-full items-center justify-between rounded-xl border border-border/80 bg-background/70 px-3 text-left text-base outline-none transition-[border-color,background-color,box-shadow] sm:text-sm",
          "[@media(pointer:coarse)]:hidden",
          "hover:border-primary/35 hover:bg-background focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          value ? "text-foreground" : "text-muted-foreground",
          open && "border-primary/45 bg-background shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]",
          error && "border-destructive ring-3 ring-destructive/20",
        )}
        onClick={(event) => {
          if (!open) {
            setDraft(parseTime(value));
            const bounds = event.currentTarget.getBoundingClientRect();
            const width = Math.min(416, document.documentElement.clientWidth - 16);
            setPopupPosition({
              left: Math.max(8, bounds.right - width) - bounds.left,
              width,
            });
          }
          setOpen((current) => !current);
        }}
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md border border-border/80 bg-background/70">
            <Clock3 className="size-3.5 text-muted-foreground" />
          </span>
          {formatTime(value)}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform group-hover:text-foreground", open && "rotate-180")} />
      </button>
      <input
        id={id}
        type="time"
        value={value}
        aria-invalid={Boolean(error)}
        className={cn(
          "hidden h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:flex sm:text-sm",
          error && "border-destructive ring-3 ring-destructive/20",
        )}
        onChange={(event) => onChange(event.target.value)}
      />

      {open ? (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          style={popupPosition}
          className="absolute right-0 z-30 mt-2 w-[min(26rem,calc(100vw-1rem))] rounded-2xl border border-primary/20 bg-popover/96 p-4 text-popover-foreground shadow-[0_24px_48px_rgb(0_0_0/0.4)] backdrop-blur-xl [@media(pointer:coarse)]:hidden"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                <Clock3 className="size-4 text-primary" />
              </span>
              <div>
                <p className="text-base font-semibold leading-tight">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a preferred time</p>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground"
              onClick={() => {
                onChange("");
                setDraft(parseTime(""));
                setOpen(false);
              }}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-border/80 bg-background/55 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Hour
                <span className="relative block">
                  <select
                    aria-label={`${label} hour`}
                    value={draft.hour}
                    className="h-12 w-full appearance-none rounded-xl border border-primary/25 bg-background px-3 pr-10 text-center text-[2rem] leading-none font-semibold tracking-tight text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    onChange={(event) => updateDraft({ hour: event.target.value })}
                  >
                    {hours.map((hour) => <option key={hour}>{hour}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </span>
            </label>
            <span className="pb-3 text-3xl font-semibold text-primary/80">:</span>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Minute
                <span className="relative block">
                  <select
                    aria-label={`${label} minute`}
                    value={draft.minute}
                    className="h-12 w-full appearance-none rounded-xl border border-primary/25 bg-background px-3 pr-10 text-center text-[2rem] leading-none font-semibold tracking-tight text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    onChange={(event) => updateDraft({ minute: event.target.value })}
                  >
                    {minutes.map((minute) => <option key={minute}>{minute}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </span>
            </label>
            <div className="col-span-3 flex h-12 overflow-hidden rounded-xl border border-border/90 bg-background/60 p-0.5 sm:col-span-1">
              {(["AM", "PM"] as const).map((meridiem) => (
                <button
                  key={meridiem}
                  type="button"
                  aria-pressed={draft.meridiem === meridiem}
                  className={cn(
                    "w-14 flex-1 rounded-[0.625rem] text-sm font-semibold tracking-wide text-muted-foreground transition-colors hover:bg-muted sm:flex-none",
                    draft.meridiem === meridiem && "bg-primary text-primary-foreground shadow-[0_8px_20px_color-mix(in_oklab,var(--primary)_35%,transparent)] hover:bg-primary/90",
                  )}
                  onClick={() => updateDraft({ meridiem })}
                >
                  {meridiem}
                </button>
              ))}
            </div>
          </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => {
                onChange(toTimeValue(draft.hour, draft.minute, draft.meridiem));
                setOpen(false);
              }}
            >
              <Check className="size-4" />
              Done
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
