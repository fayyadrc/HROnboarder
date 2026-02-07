import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const Collapsible = ({ children, className }) => {
  return <div className={cn("space-y-1", className)}>{children}</div>;
};

const CollapsibleTrigger = React.forwardRef(
  ({ children, className, isOpen, onClick, icon: Icon, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "flex items-center gap-2 w-full px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors",
          isOpen && "bg-gray-100",
          className
        )}
        onClick={onClick}
        {...props}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
        {Icon && <Icon className="h-5 w-5 text-gray-600" />}
        <span className="flex-1">{children}</span>
      </button>
    );
  }
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef(
  ({ children, className, isOpen, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
          className
        )}
        {...props}
      >
        <div className="pl-4 py-2">{children}</div>
      </div>
    );
  }
);
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
