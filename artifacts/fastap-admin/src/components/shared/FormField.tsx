import { createContext, useContext, useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled form control with help text and an error slot.
 *
 * The point is the wiring, not the styling: the label's `htmlFor`, the control's
 * `id`, `aria-describedby` for the hint, and `aria-invalid` + `aria-errormessage`
 * for the error all have to agree or a screen reader announces a field with no
 * name. Across this product that wiring is done by hand where it is done at all.
 *
 *   <FormField label="Table number" hint="Shown to the guest" error={errors.table}>
 *     {(id) => <Input id={id} value={value} onChange={...} />}
 *   </FormField>
 *
 * The render-prop form hands the control its id. For controls that cannot take
 * one, pass children directly and the field still renders correctly — it just
 * cannot link the label.
 */

interface FieldIds {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldIds | null>(null);

/** Lets a nested control opt into the ids without the render-prop form. */
export function useFormField(): FieldIds | null {
  return useContext(FieldContext);
}

export interface FormFieldProps {
  label: ReactNode;
  /** Renders the required mark and sets `aria-required` on the control. */
  required?: boolean;
  /** Static guidance, shown whether or not the field is in error. */
  hint?: ReactNode;
  /** Truthy switches the field to its error state and replaces the hint. */
  error?: ReactNode;
  children: ReactNode | ((controlId: string) => ReactNode);
  className?: string;
}

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  const uid = useId();
  const controlId = `${uid}-control`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  const invalid = Boolean(error);
  // Error replaces hint in the description so the two are never read out together.
  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  const context: FieldIds = { controlId, describedBy, invalid };

  return (
    <FieldContext.Provider value={context}>
      <div className={cn("space-y-1.5", className)}>
        <Label htmlFor={controlId}>
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        {typeof children === "function" ? children(controlId) : children}

        {invalid ? (
          <p id={errorId} className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/**
 * Two fields side by side above `sm`, stacked below it. A pair of half-width
 * fields on a 375px screen leaves neither wide enough to read what is typed in it.
 */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
