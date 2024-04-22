import { ReloadIcon } from "@radix-ui/react-icons"

import { cn } from "../utils"

export const Spinner = ({ className }: { className?: string }) => (
  <ReloadIcon className={cn("animate-spin", className)} />
)
