import * as React from "react";

export interface ModalDismissOptions {
  /** Whether the modal is currently on screen. */
  open?: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockScroll?: boolean;
}

/** Open modals, outermost first. Only the last one answers Escape. */
const stack: symbol[] = [];
let previousOverflow: string | null = null;

function lockBodyScroll() {
  if (stack.length === 1) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

function unlockBodyScroll() {
  if (stack.length === 0) {
    document.body.style.overflow = previousOverflow ?? "";
    previousOverflow = null;
  }
}

/**
 * The three things every user expects of a modal: Escape closes it, clicking
 * the dark area closes it, and the page behind does not scroll away underneath
 * it. Spread `backdropProps` onto the `fixed inset-0` wrapper.
 */
export function useModalDismiss({
  open = true,
  onClose,
  closeOnEscape = true,
  closeOnBackdrop = true,
  lockScroll = true,
}: ModalDismissOptions) {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // Mouse-down decides ownership of the click: a text selection that started
  // inside the dialog and ended on the backdrop must not close it.
  const pressedBackdropRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;

    const id = Symbol("modal");
    stack.push(id);
    if (lockScroll) lockBodyScroll();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (stack[stack.length - 1] !== id) return;
      event.stopPropagation();
      onCloseRef.current();
    }

    if (closeOnEscape) document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (closeOnEscape) document.removeEventListener("keydown", handleKeyDown);
      const index = stack.indexOf(id);
      if (index > -1) stack.splice(index, 1);
      if (lockScroll) unlockBodyScroll();
    };
  }, [open, closeOnEscape, lockScroll]);

  const handleMouseDown = React.useCallback((event: React.MouseEvent) => {
    pressedBackdropRef.current = event.target === event.currentTarget;
  }, []);

  const handleClick = React.useCallback(
    (event: React.MouseEvent) => {
      const startedOnBackdrop = pressedBackdropRef.current;
      pressedBackdropRef.current = false;
      if (!closeOnBackdrop) return;
      if (!startedOnBackdrop || event.target !== event.currentTarget) return;
      onCloseRef.current();
    },
    [closeOnBackdrop],
  );

  return {
    backdropProps: {
      onMouseDown: handleMouseDown,
      onClick: handleClick,
    },
  };
}
