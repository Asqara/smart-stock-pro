"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ACTION_MENU_COPY } from "@/constants/design";
import { mc } from "@/utils/mc";

/**
 * Single action item for row and toolbar menus.
 */
export type ActionMenuItem = {
  disabled?: boolean;
  external?: boolean;
  href?: string;
  icon?: ReactNode;
  label: string;
  onSelect?: () => void;
};

/**
 * Props for compact action menus.
 */
export type ActionMenuProps = Omit<
  ComponentPropsWithoutRef<"details">,
  "children"
> & {
  items: ActionMenuItem[];
  label?: string;
};

function ActionMenuItemContent({ icon, label }: ActionMenuItem) {
  let iconNode: ReactNode = null;

  if (icon) {
    iconNode = (
      <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-4">
        {icon}
      </span>
    );
  }

  return (
    <>
      {iconNode}
      <span>{label}</span>
    </>
  );
}

/**
 * Native details-based action menu for table row actions.
 */
export function ActionMenu({
  className,
  items,
  label = ACTION_MENU_COPY.label,
  ...props
}: ActionMenuProps) {
  return (
    <details className={mc("relative inline-block", className)} {...props}>
      <summary
        aria-label={label}
        className="inline-flex size-10 list-none items-center justify-center rounded-md text-text-muted transition-colors hover:bg-muted-surface hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </summary>
      <ul className="absolute right-0 z-20 mt-2 min-w-44 rounded-lg border border-border-default bg-elevated-surface p-1 shadow-md">
        {items.map((item) => {
          const itemClassName = mc(
            "ts-sm flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-text-default transition-colors hover:bg-muted-surface hover:text-text-strong",
            item.disabled && "pointer-events-none text-text-disabled",
          );

          if (item.href && item.external) {
            return (
              <li key={item.label}>
                <a
                  aria-disabled={item.disabled}
                  className={itemClassName}
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ActionMenuItemContent {...item} />
                </a>
              </li>
            );
          }

          if (item.href) {
            return (
              <li key={item.label}>
                <Link
                  aria-disabled={item.disabled}
                  className={itemClassName}
                  href={item.href}
                >
                  <ActionMenuItemContent {...item} />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <button
                className={itemClassName}
                disabled={item.disabled}
                onClick={item.onSelect}
                type="button"
              >
                <ActionMenuItemContent {...item} />
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
