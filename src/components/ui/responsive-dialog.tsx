"use client";

import * as React from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

type ResponsiveDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    );
  }
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      repositionInputs
    >
      {children}
    </Drawer>
  );
}

function ResponsiveDialogTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const isDesktop = useIsDesktop();
  const Comp = isDesktop ? DialogTrigger : DrawerTrigger;
  return <Comp className={className} {...props} />;
}

function ResponsiveDialogClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isDesktop = useIsDesktop();
  const Comp = isDesktop ? DialogClose : DrawerClose;
  return <Comp className={className} {...props} />;
}

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogContent className={cn("shadow-soft", className)} {...props}>
        {children}
      </DialogContent>
    );
  }

  return (
    <DrawerContent
      className={cn(
        "flex max-h-[92dvh] flex-col pb-[env(safe-area-inset-bottom)]",
        className,
      )}
      {...props}
    >
      {/* بدنه اسکرول‌شونده + فوتر sticky برای دکمه ثبت روی iOS */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </DrawerContent>
  );
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();
  const Comp = isDesktop ? DialogHeader : DrawerHeader;
  return (
    <Comp className={cn("text-start shrink-0", className)} {...props} />
  );
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return <DialogFooter className={className} {...props} />;
  }
  return (
    <DrawerFooter
      className={cn(
        "bg-background sticky bottom-0 z-10 shrink-0 border-t pt-3",
        className,
      )}
      {...props}
    />
  );
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = useIsDesktop();
  const Comp = isDesktop ? DialogTitle : DrawerTitle;
  return <Comp className={className} {...props} />;
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = useIsDesktop();
  const Comp = isDesktop ? DialogDescription : DrawerDescription;
  return <Comp className={className} {...props} />;
}

/** محتوای بلند داخل Drawer — بین header و footer */
function ResponsiveDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
};
