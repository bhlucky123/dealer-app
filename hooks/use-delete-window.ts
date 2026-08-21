import { useAuthStore } from "@/store/auth";
import { useEffect, useState } from "react";

/**
 * Per-draw deletion-time window (`Draw.delete_time_limit`).
 *
 * The booking report sends `deletable_until` — the moment a booking drops out of
 * its draw's window, or null when the draw sets no limit. Once it passes, the
 * backend only lets the super admin / main vendor admin with the 'delete_booking'
 * feature delete (see `is_delete_window_expired` in draw/booking/views.py), so
 * everyone else loses the delete action.
 */
export const isDeleteWindowExpired = (
    deletableUntil?: string | null,
    now: number = Date.now()
) => {
    if (!deletableUntil) return false;
    const deadline = new Date(deletableUntil).getTime();
    if (Number.isNaN(deadline)) return false;
    return now > deadline;
};

/** Mirror of `can_delete_after_cutoff()` on the backend. */
export const useCanBypassDeleteWindow = () => {
    const { user, hasFeature } = useAuthStore();
    if (!user) return false;
    if (user.superuser) return true;
    return (
        user.user_type === "ADMIN" &&
        !!user.is_main_vendor &&
        hasFeature("delete_booking")
    );
};

/**
 * Re-renders the caller every `intervalMs` so a row's delete action disappears on
 * its own when the window runs out while the screen is open.
 */
export const useNow = (intervalMs = 30000) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
};
