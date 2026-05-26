"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import {
  DATE_INPUT_COPY,
  DATE_INPUT_CLASS_NAMES,
  DATE_INPUT_WEEKDAY_LABELS,
  FIELD_CLASS_NAMES,
  SELECT_CLASS_NAMES,
} from "@/constants/design";
import { mc } from "@/utils/mc";

/**
 * Props for accessible form field wrappers.
 */
export type FieldProps = ComponentPropsWithoutRef<"section"> & {
  errorMessage?: string;
  fieldId: string;
  helperText?: string;
  label: string;
  required?: boolean;
};

export function Field({
  children,
  className,
  errorMessage,
  fieldId,
  helperText,
  label,
  required = false,
  ...props
}: FieldProps) {
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  let requiredNode: ReactNode = null;
  if (required) {
    requiredNode = <span aria-hidden="true" className="text-danger">*</span>;
  }

  let helperNode: ReactNode = null;
  if (helperText) {
    helperNode = <span className={FIELD_CLASS_NAMES.helper} id={helperId}>{helperText}</span>;
  }

  let errorNode: ReactNode = null;
  if (errorMessage) {
    errorNode = <span className={FIELD_CLASS_NAMES.error} id={errorId} role="alert">{errorMessage}</span>;
  }

  return (
    <section className={mc(FIELD_CLASS_NAMES.wrapper, className)} {...props}>
      <label className={FIELD_CLASS_NAMES.label} htmlFor={fieldId}>
        {label}
        {requiredNode}
      </label>
      {children}
      {helperNode}
      {errorNode}
    </section>
  );
}

type FieldControlProps = {
  errorMessage?: string;
  helperText?: string;
  id: string;
  label: string;
};

function getDescribedBy({ errorMessage, helperText, id }: FieldControlProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  if (helperText && errorMessage) return `${helperId} ${errorId}`;
  if (helperText) return helperId;
  if (errorMessage) return errorId;
  return undefined;
}

const dateInputMonthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});

const dateInputSelectedFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
});

function getDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getParsedDate(value?: string) {
  if (!value) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function getCalendarDays(monthDate: Date) {
  const firstDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDate = new Date(firstDate);
  startDate.setDate(firstDate.getDate() - firstDate.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

/**
 * Text Input
 */
export type TextInputProps = Omit<ComponentPropsWithoutRef<"input">, "id"> & FieldControlProps;

export function TextInput({ className, errorMessage, helperText, id, label, required, ...props }: TextInputProps) {
  const describedBy = getDescribedBy({ errorMessage, helperText, id, label });
  const hasError = Boolean(errorMessage);

  return (
    <Field errorMessage={errorMessage} fieldId={id} helperText={helperText} label={label} required={required}>
      <input
        aria-describedby={describedBy}
        aria-invalid={hasError}
        className={mc(FIELD_CLASS_NAMES.control, className)}
        id={id}
        required={required}
        {...props}
      />
    </Field>
  );
}

/**
 * Select Input Option Type
 */
export type SelectInputOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

/**
 * Multi Select Input
 */
export type MultiSelectInputProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "id" | "name" | "onBlur" | "onChange" | "value"
> &
  FieldControlProps & {
    name?: string;
    onBlur?: () => void;
    onValueChange?: (value: string[]) => void;
    options: SelectInputOption[];
    placeholder?: string;
    required?: boolean;
    value?: string[];
  };

export function MultiSelectInput({
  className,
  disabled,
  errorMessage,
  helperText,
  id,
  label,
  name,
  onBlur,
  onValueChange,
  options,
  placeholder = "Pilih beberapa opsi",
  required,
  value = [],
  ...props
}: MultiSelectInputProps) {
  const [open, setOpen] = useState(false);
  const describedBy = getDescribedBy({ errorMessage, helperText, id, label });
  const listboxId = `${id}-listbox`;

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  const displayLabel = selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder;
  const selectedValueClassName = selectedLabels.length > 0 ? undefined : SELECT_CLASS_NAMES.placeholder;

  const handleToggleOption = (optionValue: string) => {
    const isSelected = value.includes(optionValue);
    const nextValue = isSelected ? value.filter((v) => v !== optionValue) : [...value, optionValue];
    onValueChange?.(nextValue);
  };

  const optionNodes = options.map((option) => {
    const isSelected = value.includes(option.value);
    return (
      <li key={option.value}>
        <button
          aria-selected={isSelected}
          className={mc(SELECT_CLASS_NAMES.option, isSelected && SELECT_CLASS_NAMES.optionActive)}
          disabled={option.disabled}
          onClick={(e) => {
            e.preventDefault();
            handleToggleOption(option.value);
          }}
          role="option"
          type="button"
        >
          {isSelected ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary-blue" /> : <span className="size-4 shrink-0" />}
          <span className="truncate">{option.label}</span>
        </button>
      </li>
    );
  });

  return (
    <Field errorMessage={errorMessage} fieldId={id} helperText={helperText} label={label} required={required}>
      <section
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            onBlur?.();
          }
        }}
      >
        <button
          aria-controls={listboxId}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={mc(SELECT_CLASS_NAMES.trigger, className)}
          disabled={disabled}
          id={id}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          type="button"
          {...props}
        >
          <span className="flex min-w-0 items-center justify-between gap-3">
            <span className={mc(SELECT_CLASS_NAMES.value, selectedValueClassName, "truncate")}>
              {displayLabel}
            </span>
            <ChevronDown aria-hidden="true" className={mc("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")} />
          </span>
        </button>
        {open && (
          <ul className={SELECT_CLASS_NAMES.panel} id={listboxId} role="listbox" aria-multiselectable="true">
            {optionNodes}
          </ul>
        )}
      </section>
    </Field>
  );
}

/**
 * Unified Date Input (Single & Range)
 */
export type DateRangeValue = {
  from: string;
  to: string;
};

type BaseDateInputProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "id" | "name" | "onBlur" | "onChange" | "value"
> &
  FieldControlProps & {
    name?: string;
    onBlur?: () => void;
    placeholder?: string;
    required?: boolean;
  };

type SingleDateProps = BaseDateInputProps & {
  mode?: "single";
  value?: string;
  onValueChange?: (value: string) => void;
};

type RangeDateProps = BaseDateInputProps & {
  mode: "range";
  value?: DateRangeValue;
  onValueChange?: (value: DateRangeValue) => void;
};

/**
 * Props for textarea fields.
 */
export type TextareaInputProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "id"
> &
  FieldControlProps;

/**
 * Labeled textarea with helper and error states.
 */
export function TextareaInput({
  className,
  errorMessage,
  helperText,
  id,
  label,
  required,
  ...props
}: TextareaInputProps) {
  const describedBy = getDescribedBy({ errorMessage, helperText, id, label });
  const hasError = Boolean(errorMessage);

  return (
    <Field
      errorMessage={errorMessage}
      fieldId={id}
      helperText={helperText}
      label={label}
      required={required}
    >
      <textarea
        aria-describedby={describedBy}
        aria-invalid={hasError}
        className={mc(FIELD_CLASS_NAMES.textarea, className)}
        id={id}
        required={required}
        {...props}
      />
    </Field>
  );
}

/**
 * Props for select fields.
 */
export type SelectInputProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "id" | "name" | "onBlur" | "onChange" | "value"
> &
  FieldControlProps & {
    name?: string;
    onBlur?: () => void;
    onValueChange?: (value: string) => void;
    options: SelectInputOption[];
    placeholder?: string;
    required?: boolean;
    value?: string;
  };

/**
 * Labeled custom select field with helper and error states.
 */
export function SelectInput({
  className,
  disabled,
  errorMessage,
  helperText,
  id,
  label,
  name,
  onBlur,
  onValueChange,
  options,
  placeholder = "Pilih opsi",
  required,
  value,
  ...props
}: SelectInputProps) {
  const [open, setOpen] = useState(false);
  const describedBy = getDescribedBy({ errorMessage, helperText, id, label });
  const listboxId = `${id}-listbox`;
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? placeholder;
  const selectedValueClassName = selectedOption
    ? undefined
    : SELECT_CLASS_NAMES.placeholder;
  const optionNodes = options.map((option) => {
    const isSelected = option.value === value;
    let checkNode: ReactNode = <span className="size-4 shrink-0" />;

    if (isSelected) {
      checkNode = (
        <Check aria-hidden="true" className="size-4 shrink-0 text-primary-blue" />
      );
    }

    return (
      <li key={option.value}>
        <button
          aria-selected={isSelected}
          className={mc(
            SELECT_CLASS_NAMES.option,
            isSelected && SELECT_CLASS_NAMES.optionActive,
          )}
          disabled={option.disabled}
          onClick={() => {
            onValueChange?.(option.value);
            onBlur?.();
            setOpen(false);
          }}
          role="option"
          type="button"
        >
          {checkNode}
          <span className="truncate">{option.label}</span>
        </button>
      </li>
    );
  });

  let panelNode: ReactNode = null;

  if (open) {
    panelNode = (
      <ul className={SELECT_CLASS_NAMES.panel} id={listboxId} role="listbox">
        {optionNodes}
      </ul>
    );
  }

  return (
    <Field
      errorMessage={errorMessage}
      fieldId={id}
      helperText={helperText}
      label={label}
      required={required}
    >
      <section
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            onBlur?.();
          }
        }}
      >
        <button
          aria-controls={listboxId}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={mc(SELECT_CLASS_NAMES.trigger, className)}
          disabled={disabled}
          id={id}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          type="button"
          {...props}
        >
          <span className="flex min-w-0 items-center justify-between gap-3">
            <span className={mc(SELECT_CLASS_NAMES.value, selectedValueClassName)}>
              {selectedLabel}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={mc(
                "size-4 shrink-0 text-text-muted transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        </button>
        <input
          aria-hidden="true"
          className="sr-only"
          name={name}
          readOnly
          tabIndex={-1}
          value={value ?? ""}
        />
        {panelNode}
      </section>
    </Field>
  );
}

export type DateInputProps = SingleDateProps | RangeDateProps;

type DatePanelHorizontalPlacement = "left" | "right";
type DatePanelVerticalPlacement = "above" | "below";

export function DateInput(props: DateInputProps) {
  const {
    className,
    disabled,
    errorMessage,
    helperText,
    id,
    label,
    mode = "single",
    name,
    onBlur,
    placeholder = "Pilih tanggal",
    required,
    value,
    onValueChange,
    ...restProps
  } = props;

  const isRange = mode === "range";
  const singleValue = !isRange && typeof value === "string" ? value : "";
  const rangeValue = isRange && typeof value === "object" && value !== null ? value : { from: "", to: "" };

  const parsedFrom = isRange ? getParsedDate(rangeValue.from) : getParsedDate(singleValue);
  const parsedTo = isRange ? getParsedDate(rangeValue.to) : null;

  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(parsedFrom ?? new Date());
  const [horizontalPlacement, setHorizontalPlacement] =
    useState<DatePanelHorizontalPlacement>("left");
  const [verticalPlacement, setVerticalPlacement] =
    useState<DatePanelVerticalPlacement>("below");
  const wrapperRef = useRef<HTMLElement | null>(null);
  
  const describedBy = getDescribedBy({ errorMessage, helperText, id, label });
  const panelId = `${id}-calendar`;
  const calendarDays = getCalendarDays(visibleMonth);

  let selectedLabel = placeholder;
  let hasValue = false;

  if (!isRange && parsedFrom) {
    selectedLabel = dateInputSelectedFormatter.format(parsedFrom);
    hasValue = true;
  } else if (isRange && parsedFrom) {
    if (parsedTo) {
      selectedLabel = `${dateInputSelectedFormatter.format(parsedFrom)} - ${dateInputSelectedFormatter.format(parsedTo)}`;
    } else {
      selectedLabel = `${dateInputSelectedFormatter.format(parsedFrom)} - ...`;
    }
    hasValue = true;
  }

  const selectedValueClassName = hasValue ? undefined : DATE_INPUT_CLASS_NAMES.placeholder;

  const handleDayClick = (dateValue: string, date: Date) => {
    if (!isRange) {
      const onChange = onValueChange as ((val: string) => void) | undefined;
      onChange?.(dateValue);
      setOpen(false);
      onBlur?.();
      return;
    }

    const onChange = onValueChange as ((val: DateRangeValue) => void) | undefined;
    if ((rangeValue.from && rangeValue.to) || !rangeValue.from) {
      onChange?.({ from: dateValue, to: "" });
    } else {
      if (parsedFrom && date < parsedFrom) {
        onChange?.({ from: dateValue, to: "" });
      } else {
        onChange?.({ from: rangeValue.from, to: dateValue });
        setOpen(false);
        onBlur?.();
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePlacement = () => {
      const wrapper = wrapperRef.current;

      if (!wrapper) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      const panelWidth = 320;
      const panelHeight = 360;
      const viewportPadding = 12;
      const rightOverflow =
        rect.left + panelWidth > window.innerWidth - viewportPadding;
      const bottomOverflow =
        rect.bottom + panelHeight > window.innerHeight - viewportPadding;
      const hasTopSpace = rect.top > panelHeight;

      setHorizontalPlacement(rightOverflow ? "right" : "left");
      setVerticalPlacement(bottomOverflow && hasTopSpace ? "above" : "below");
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  const weekDayNodes = DATE_INPUT_WEEKDAY_LABELS.map((day) => (
    <span className={DATE_INPUT_CLASS_NAMES.weekDay} key={day}>
      {day}
    </span>
  ));

  const dayNodes = calendarDays.map((date) => {
    const dateValue = getDateValue(date);
    const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
    
    let isSelected = false;
    let isInRange = false;

    if (!isRange) {
      isSelected = singleValue === dateValue;
    } else {
      isSelected = rangeValue.from === dateValue || rangeValue.to === dateValue;
      isInRange = Boolean(parsedFrom && parsedTo && date > parsedFrom && date < parsedTo);
    }

    return (
      <button
        aria-pressed={isSelected}
        className={mc(
          DATE_INPUT_CLASS_NAMES.day,
          !isCurrentMonth && DATE_INPUT_CLASS_NAMES.dayMuted,
          isSelected && DATE_INPUT_CLASS_NAMES.daySelected,
          isInRange && "bg-primary-blue/10 text-primary-blue rounded-none" 
        )}
        key={dateValue}
        onClick={() => handleDayClick(dateValue, date)}
        type="button"
      >
        {date.getDate()}
      </button>
    );
  });

  return (
    <Field errorMessage={errorMessage} fieldId={id} helperText={helperText} label={label} required={required}>
      <section
        className={DATE_INPUT_CLASS_NAMES.wrapper}
        ref={wrapperRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            onBlur?.();
          }
        }}
      >
        <button
          aria-controls={panelId}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={mc(DATE_INPUT_CLASS_NAMES.trigger, className)}
          disabled={disabled}
          id={id}
          onClick={() => {
            setVisibleMonth(parsedFrom ?? new Date());
            setOpen((currentOpen) => !currentOpen);
          }}
          type="button"
          {...restProps} 
        >
          <span className={mc(DATE_INPUT_CLASS_NAMES.value, selectedValueClassName)}>
            {selectedLabel}
          </span>
        </button>
        <CalendarDays aria-hidden="true" className={DATE_INPUT_CLASS_NAMES.icon} />
        
        {open && (
          <section
            aria-label={`Kalender ${label}`}
            className={mc(
              DATE_INPUT_CLASS_NAMES.panel,
              horizontalPlacement === "right" ? "right-0" : "left-0",
              verticalPlacement === "above"
                ? "bottom-full mb-2"
                : "top-full mt-2",
            )}
            id={panelId}
            role="dialog"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <button
                className="grid size-9 place-items-center rounded-md text-text-muted transition-colors hover:bg-muted-surface hover:text-text-strong"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <p className="ts-sm font-semibold text-text-strong">
                {dateInputMonthFormatter.format(visibleMonth)}
              </p>
              <button
                className="grid size-9 place-items-center rounded-md text-text-muted transition-colors hover:bg-muted-surface hover:text-text-strong"
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                type="button"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </header>
            <section className="grid grid-cols-7 gap-1">
              {weekDayNodes}
              {dayNodes}
            </section>
          </section>
        )}
      </section>
    </Field>
  );
}
