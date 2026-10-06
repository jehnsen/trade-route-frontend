import { toast } from "sonner";
import { errorMessage } from "@/lib/api/client";

/**
 * Run a store action from a click or form submit. The API decides whether it is allowed: on
 * success `onDone` gets the result (toast, navigate…); on failure the API's reason is toasted.
 * Resolves to whether the action went through.
 */
export async function act<T>(action: () => Promise<T>, onDone?: (result: T) => void): Promise<boolean> {
  try {
    const result = await action();
    onDone?.(result);
    return true;
  } catch (e) {
    toast.error("Not saved", { description: errorMessage(e) });
    return false;
  }
}
