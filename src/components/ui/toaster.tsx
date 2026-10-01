"use client"

import { CheckCircle2, Info, XCircle } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const variantConfig = {
  success: { Icon: CheckCircle2, iconClassName: "text-blue-600" },
  destructive: { Icon: XCircle, iconClassName: "text-white" },
  default: { Icon: Info, iconClassName: "text-muted-foreground" },
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const { Icon, iconClassName } =
          variantConfig[variant ?? "default"] ?? variantConfig.default
        return (
          <Toast key={id} variant={variant} {...props}>
            <Icon className={`size-4 shrink-0 ${iconClassName}`} />
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
