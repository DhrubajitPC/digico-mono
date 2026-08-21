import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";
import {
  Content,
  Item,
  ItemIndicator,
  Portal,
  RadioGroup,
  RadioItem,
  Root,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "../lib/utils.js";

export const DropdownMenu = Root;
export const DropdownMenuRadioGroup = RadioGroup;

export const DropdownMenuTrigger = forwardRef<
  ComponentRef<typeof Trigger>,
  ComponentPropsWithoutRef<typeof Trigger>
>(({ className, ...props }, ref) => (
  <Trigger
    ref={ref}
    className={cn(
      "inline-flex cursor-pointer items-center outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuTrigger.displayName = Trigger.displayName;

export const DropdownMenuContent = forwardRef<
  ComponentRef<typeof Content>,
  ComponentPropsWithoutRef<typeof Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <Portal>
    <Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-56 rounded-md border border-gray-100 bg-white p-1 shadow-lg ring-1 ring-black/5 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </Portal>
));
DropdownMenuContent.displayName = Content.displayName;

const itemClassName =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-base text-gray-700 outline-none data-[highlighted]:bg-gray-100";

export const DropdownMenuItem = forwardRef<
  ComponentRef<typeof Item>,
  ComponentPropsWithoutRef<typeof Item>
>(({ className, ...props }, ref) => (
  <Item ref={ref} className={cn(itemClassName, className)} {...props} />
));
DropdownMenuItem.displayName = Item.displayName;

export const DropdownMenuRadioItem = forwardRef<
  ComponentRef<typeof RadioItem>,
  ComponentPropsWithoutRef<typeof RadioItem>
>(({ className, children, ...props }, ref) => (
  <RadioItem ref={ref} className={cn(itemClassName, "justify-between", className)} {...props}>
    {children}
    <ItemIndicator>
      <Check size={14} className="ml-2 text-blue-600" />
    </ItemIndicator>
  </RadioItem>
));
DropdownMenuRadioItem.displayName = RadioItem.displayName;
