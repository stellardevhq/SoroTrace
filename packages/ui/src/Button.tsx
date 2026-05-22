import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export function Button({
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  return (
    <button data-variant={variant} {...props}>
      {children}
    </button>
  );
}
