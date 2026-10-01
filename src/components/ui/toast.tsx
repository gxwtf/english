"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function ToastProvider({
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed top-0 right-0 left-0 z-[100] flex max-h-screen flex-col items-center gap-2 p-4 sm:top-2",
        className
      )}
      {...props}
    />
  )
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg border py-2.5 pr-9 pl-4 text-sm shadow-lg backdrop-blur-md transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 sm:w-auto sm:min-w-[240px] sm:max-w-[90vw]",
  {
    variants: {
      variant: {
        default: "border-border bg-background/95 text-foreground",
        success:
          "border-blue-200 bg-blue-50/95 text-blue-900 dark:border-blue-800 dark:bg-blue-950/90 dark:text-blue-100",
        destructive:
          "border-destructive/40 bg-destructive/95 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Toast({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> &
  VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Action>) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:ring-2 focus:ring-ring focus:outline-hidden disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="关闭通知"
      className={cn(
        "absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-current opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden",
        className
      )}
      {...props}
    >
      <XIcon className="size-4" />
    </ToastPrimitive.Close>
  )
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm opacity-90", className)}
      {...props}
    />
  )
}

type ToastProps = React.ComponentProps<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
}
