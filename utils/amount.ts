
/**
 * Formats a number into a human-readable string with Indian units.
 * - 1 Cr = 1 Crore = 10,000,000
 * - 1 L = 1 Lakh = 100,000
 * 
 * Examples:
 *   amountHandler(12345678) => "1.23 Cr"
 *   amountHandler(234567)   => "2.35 L"
 *   amountHandler(99999)    => "99,999"
 *   amountHandler(0)        => "0"
 */
export const amountHandler = (num: number): string => {
    if (typeof num !== "number" || isNaN(num)) return "0";
    if (num >= 10000000) {
        return `${(num / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`;
    } else if (num >= 100000) {
        return `${(num / 100000).toFixed(2).replace(/\.00$/, "")} L`;
    } else if (num >= 1000) {
        // Add comma for thousands (Indian style: 12,345)
        return num.toLocaleString("en-IN");
    }
    return `${num}`;
};