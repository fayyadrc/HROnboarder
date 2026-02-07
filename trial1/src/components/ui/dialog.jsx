import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const DialogContext = React.createContext({});

function Dialog({ open, onOpenChange, children }) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogPortal({ children }) {
  const { open } = React.useContext(DialogContext);
  if (!open) return null;
  return <>{children}</>;
}

const DialogOverlay = React.forwardRef(({ className, preventClose, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);
  
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        "animate-in fade-in-0 duration-300 ease-out",
        className
      )}
      onClick={() => !preventClose && onOpenChange?.(false)}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef(({ className, children, hideCloseButton, preventClose, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);
  
  return (
    <DialogPortal>
      <DialogOverlay preventClose={preventClose} />
      <div
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
          "bg-white rounded-lg shadow-lg border border-gray-200 p-6",
          "animate-in fade-in-0 duration-300 ease-out",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <button
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-500", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
