import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export interface AsyncButtonProps extends Omit<ButtonProps, "onClick"> {
  /** May return a promise. While it is in flight the button disables and spins. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
  /** Replaces the label while the action runs, e.g. "Saving…". */
  pendingLabel?: React.ReactNode;
  /** Toasted when the promise resolves. */
  successMessage?: string;
  /** Toasted when the promise rejects. */
  errorMessage?: string;
  /** Takes over failure handling entirely — no toast is shown when supplied. */
  onError?: (error: unknown) => void;
  /** Pending state owned elsewhere, e.g. a mutation's `isPending`. */
  pending?: boolean;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === "function";
}

function detailOf(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return undefined;
}

/**
 * A `Button` that owns the pending state of its own action, so a slow request
 * cannot be fired twice by an impatient second tap and never leaves the user
 * guessing whether anything happened. Drop-in for `Button`: a handler that
 * returns nothing behaves exactly as before.
 */
const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (
    {
      onClick,
      pendingLabel,
      successMessage,
      errorMessage = "That didn't go through. Please try again.",
      onError,
      pending,
      disabled,
      children,
      asChild,
      ...props
    },
    ref,
  ) => {
    const [running, setRunning] = React.useState(false);
    // The `disabled` attribute only lands on the next render, so a fast
    // double-tap can reach the handler twice before React repaints.
    const runningRef = React.useRef(false);
    const mountedRef = React.useRef(true);

    React.useEffect(
      () => () => {
        mountedRef.current = false;
      },
      [],
    );

    const isPending = running || pending === true;

    const handleClick = React.useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (runningRef.current) return;

        const result = onClick?.(event);
        if (!isPromiseLike(result)) return;

        runningRef.current = true;
        setRunning(true);
        try {
          await result;
          if (successMessage) toast({ title: successMessage });
        } catch (error) {
          if (onError) onError(error);
          else toast({ title: errorMessage, description: detailOf(error), variant: "destructive" });
        } finally {
          runningRef.current = false;
          // The action may have navigated away or closed the dialog holding us.
          if (mountedRef.current) setRunning(false);
        }
      },
      [errorMessage, onClick, onError, successMessage],
    );

    // `asChild` renders through a Slot, which accepts exactly one child, so the
    // spinner is only injected when we own the markup.
    const showSpinner = isPending && !asChild;

    return (
      <Button
        ref={ref}
        asChild={asChild}
        disabled={disabled || isPending}
        aria-busy={isPending || undefined}
        onClick={handleClick}
        {...props}
      >
        {showSpinner ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {pendingLabel ?? children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  },
);
AsyncButton.displayName = "AsyncButton";

export { AsyncButton };
