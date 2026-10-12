"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type TimePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

type Period = "AM" | "PM";

function getTimeParts(value: string): { time: string; period: Period } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  return {
    time: `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]}`,
    period: hour < 12 ? "AM" : "PM",
  };
}

function formatTimeLabel(value: string) {
  const match = /^(1[0-2]|0?[1-9]):([0-5]\d)$/.exec(value);
  return match ? `${Number(match[1])}:${match[2]}` : "";
}

function toStoredTime(value: string, period: Period) {
  const match = /^(1[0-2]|0?[1-9]):([0-5]\d)$/.exec(value);
  if (!match) return "";

  const hour = Number(match[1]) % 12 + (period === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

const halfHourOptions = Array.from({ length: 24 }, (_, index) => {
  const totalMinutes = index * 30;
  const hour = Math.floor(totalMinutes / 60) % 12 || 12;
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { value, label: `${hour}:${String(minute).padStart(2, "0")}` };
});

export function TimePicker({ id, label, value, onChange, error }: TimePickerProps) {
  const timeParts = getTimeParts(value);
  const [emptyPeriod, setEmptyPeriod] = useState<Period>("AM");
  const [open, setOpen] = useState(false);
  const period = timeParts?.period ?? emptyPeriod;
  const options = halfHourOptions.some((option) => option.value === timeParts?.time) || !timeParts
    ? halfHourOptions
    : [...halfHourOptions, { value: timeParts.time, label: formatTimeLabel(timeParts.time) }]
      .sort((left, right) => left.value.localeCompare(right.value));
  const errorId = `${id}-error`;

  function handlePeriodChange(nextPeriod: Period) {
    if (!timeParts) {
      setEmptyPeriod(nextPeriod);
      return;
    }

    onChange(toStoredTime(timeParts.time, nextPeriod));
  }

  function handleTimeChange(time: string) {
    if (!time) setEmptyPeriod(period);
    onChange(toStoredTime(time, period));
  }

  function handleTimeSelect(time: string) {
    onChange(toStoredTime(time, period));
    setOpen(false);
  }

  function renderPeriodButtons(location: "mobile" | "dialog") {
    return (
      <div
        role="group"
        aria-label={`${label} period`}
        className={cn(
          location === "dialog"
            ? "mt-4 grid w-full grid-cols-2 gap-2"
            : "flex shrink-0 items-center rounded-lg bg-muted/70 p-0.5",
        )}
      >
        {(["AM", "PM"] as const).map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`${id}-${location}-${option.toLowerCase()}`}
            aria-label={`${label} ${option}`}
            aria-pressed={period === option}
            className={cn(
              "h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              period === option
                ? location === "dialog"
                  ? "w-full border-primary/50 bg-primary/10 text-primary shadow-sm"
                  : "border-transparent bg-primary text-primary-foreground shadow-sm"
                : location === "dialog"
                  ? "w-full border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handlePeriodChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p id={`${id}-label`} className="text-sm font-medium leading-none">{label}</p>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "flex h-12 w-full min-w-0 items-center rounded-xl border border-border/80 bg-background px-2 transition-colors hover:border-primary/35 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            error && "border-destructive ring-3 ring-destructive/20",
          )}
        >
          <div className="relative min-w-0 flex-1 md:hidden">
            <select
              id={id}
              aria-label={label}
              value={timeParts?.time ?? ""}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="h-11 w-full min-w-0 appearance-none rounded-l-lg bg-transparent px-2 pr-8 text-base text-foreground outline-none"
              onChange={(event) => handleTimeChange(event.currentTarget.value)}
            >
              <option value="">Select time</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <Dialog.Trigger
            type="button"
            data-testid={`${id}-desktop-trigger`}
            aria-label={`${label}, ${timeParts ? `${formatTimeLabel(timeParts.time)} ${timeParts.period}` : "select time"}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="hidden h-11 min-w-0 flex-1 items-center justify-between rounded-lg px-3 text-left text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex sm:text-sm"
          >
            <span className="truncate">
              {timeParts ? `${formatTimeLabel(timeParts.time)} ${timeParts.period}` : "Select time"}
            </span>
            <ChevronDown aria-hidden="true" className="ml-3 size-4 shrink-0 text-muted-foreground" />
          </Dialog.Trigger>
          <div className="md:hidden">
            {renderPeriodButtons("mobile")}
          </div>
        </div>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="min-w-0 text-base font-semibold">{label}</Dialog.Title>
              <Dialog.Close
                aria-label="Close time selection"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </div>
            {renderPeriodButtons("dialog")}
            <div
              data-testid={`${id}-time-options`}
              className="mt-4 grid max-h-[min(58dvh,32rem)] grid-cols-4 gap-1.5 overflow-y-auto pr-1"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`${label} ${option.label} ${period}`}
                  aria-pressed={timeParts?.time === option.value}
                  className={cn(
                    "h-9 rounded-lg border border-border bg-background/70 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    timeParts?.time === option.value && "border-primary/60 bg-primary/10 text-primary",
                  )}
                  onClick={() => handleTimeSelect(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {error ? <p id={errorId} className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
