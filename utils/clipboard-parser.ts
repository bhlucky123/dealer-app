// Bundled fallback for clipboard paste when the parse API is unavailable.
// Snapshot of the grammar previously shipped in app/book.tsx.
// New formats belong in the backend parser; this snapshot changes only with an app release.
export type ClipboardParseResult = {
  bookings: { number: string; count: number; sub_type: string }[];
  failed_lines: string[];
};

export function parseClipboardLocally(clipboardText: string, drawType: string): ClipboardParseResult {
  const isDefaultDraw = drawType === "default";
  const isKeralaDraw = drawType === "kerala";
  const isTamilNaduDraw = drawType === "tamil_nadu";
  const SINGLE_DIGIT_MIN_COUNT = 5;

  // Split into lines and trim
  const lines = clipboardText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Prepare to collect bookings and failed lines
  let bookings: { number: string; count: number; subType: string }[] = [];
  let failedLines: string[] = [];

  // Regex for WhatsApp metadata prefix
  const waPrefixRegex = /^\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*\d{1,2}:\d{2}(?:\s*[APMapm\.]*)?\]\s*[^:]*:/;

  // Lines like "Dear 6", "Kerala 3" — chatter, silently skipped.
  const ignoreLineRegex = /^\s*[A-Za-z ]+\d+\s*$/;
  // Partial WhatsApp booking replies start with this heading. Ignore it so
  // staff can paste the entire reply without a failed-line warning.
  const pendingHeaderRegex = /^\s*pending\s*:?\s*$/i;

  // --- VALID SUBTYPES BY NUMBER LENGTH ---
  const validSubTypesByLength: { [len: number]: string[] } = {
    1: ["A", "B", "C"],
    2: ["AB", "AC", "BC"],
    3: ["SUPER", "BOX", "SET", "BOTH"],
  };
  let sectionSubType: string | undefined;

  // Helper: Validate if subType is allowed for number length
  function isValidSubtypeForNumber(number: string, subType: string) {
    // Non-default draws don't use sub_type
    if (!isDefaultDraw) return true;
    const len = number.length;
    const st = (subType || "").toUpperCase();
    if (!validSubTypesByLength[len]) return false;
    if (len === 3 && st === "BOTH") return true;
    return validSubTypesByLength[len].includes(st);
  }

  // Helper: Add booking with fallback subType and validation
  function pushBooking(number: string, count: number, subType?: string) {
    if (!number || isNaN(Number(number)) || !count || isNaN(Number(count)) || Number(count) <= 0) return false;
    let nlen = number.length;

    // Validate number length for draw type
    if (isKeralaDraw && nlen !== 4) return false;
    if (isTamilNaduDraw && nlen !== 3) return false;
    if (isDefaultDraw && ![1, 2, 3].includes(nlen)) return false;

    // Single-digit numbers must be booked with a count of at least 5
    if (isDefaultDraw && nlen === 1 && Number(count) < SINGLE_DIGIT_MIN_COUNT) return false;

    let st = (subType || "").toUpperCase();

    // For non-default draws, sub_type is not used
    if (!isDefaultDraw) {
      bookings.push({ number, count: Number(count), subType: "" });
      return true;
    }

    // A two-digit number needs its own subtype or a preceding section.
    if (nlen === 2 && !st) st = sectionSubType || "";
    if (nlen === 2 && !st) return false;

    // Default subType logic for single and triple digits.
    if (!st) {
      if (nlen === 1) st = "A";
      else st = "SUPER";
    }

    // Validate subType for number length
    if (!isValidSubtypeForNumber(number, st)) return false;

    bookings.push({ number, count: Number(count), subType: st });
    return true;
  }

  // Helper: Add both SUPER and BOX for dual count (only for 3-digit)
  function pushDualBooking(number: string, count1: number, count2: number) {
    if (number.length !== 3) return false;
    let ok1 = pushBooking(number, count1, "SUPER");
    let ok2 = pushBooking(number, count2, "BOX");
    return ok1 && ok2;
  }

  // Helper: For SET subtype and 3-digit, push all perms with given subType (SUPER, BOX, or BOTH)
  function pushSetBookings(number: string, count: number, perEntrySubType?: string) {
    if (number.length === 3) {
      const perms = Array.from(new Set([
        number[0] + number[1] + number[2],
        number[0] + number[2] + number[1],
        number[1] + number[0] + number[2],
        number[1] + number[2] + number[0],
        number[2] + number[0] + number[1],
        number[2] + number[1] + number[0],
      ]));
      let anyOk = false;
      const st = (perEntrySubType || "SUPER").toUpperCase();
      for (let perm of perms) {
        if (st === "BOTH") {
          let ok1 = pushBooking(perm, count, "SUPER");
          let ok2 = pushBooking(perm, count, "BOX");
          if (ok1 || ok2) anyOk = true;
        } else {
          if (pushBooking(perm, count, st)) anyOk = true;
        }
      }
      return anyOk;
    }
    return false;
  }

  // Helper: "Abc" means every subtype for the number's length
  function pushAbcBookings(number: string, count: number) {
    const group = number.length === 1 ? ["A", "B", "C"] : ["AB", "AC", "BC"];
    let allOk = true;
    for (const st of group) {
      if (!pushBooking(number, count, st)) allOk = false;
    }
    return allOk;
  }

  // ---------------------------------------------------------------------
  // NORMALIZE + TOKENIZE
  //
  // Every supported line is "numbers and words separated by punctuation".
  // Rather than one regex per format, strip the leading/trailing noise,
  // collapse each run of separators into a single break, then decide what
  // the line means from the *shape* of the token list. That covers
  // repeated separators ("123--5", "123...2"), trailing punctuation
  // ("123=30.", "123.1."), bracketed counts ("123(1)(1)"), a subtype glued
  // to the count ("123.2set") and underscore/semicolon/quote separators
  // ("123_5", "114;1", "123''1") without a regex for each one.
  // ---------------------------------------------------------------------
  type Tok = { isNum: boolean; value: string };

  // Anything that can sit between a number, a count and a subtype.
  const SEPARATORS = /[\s.\-=+:/,_;*#&|\\()\[\]{}<>'"‘’“”´`]+/;

  function tokenizeLine(raw: string): Tok[] | null {
    // Drop leading/trailing noise: "123=30." -> "123=30", "(123)" -> "123"
    const trimmed = raw.replace(/^[^0-9A-Za-z]+/, "").replace(/[^0-9A-Za-z]+$/, "");
    if (!trimmed) return null;

    const tokens: Tok[] = [];
    for (const part of trimmed.split(SEPARATORS)) {
      if (!part) continue;
      // A part may still glue the count to the subtype ("2set") — split it.
      const pieces = part.match(/\d+|[A-Za-z]+/g);
      // Unknown characters (emoji, other scripts) — don't guess at the line.
      if (!pieces || pieces.join("").length !== part.length) return null;
      for (const piece of pieces) {
        tokens.push({ isNum: /^\d+$/.test(piece), value: /^\d+$/.test(piece) ? piece : piece.toUpperCase() });
      }
    }
    return tokens.length ? tokens : null;
  }

  // A word that describes how to book, not which subtype to remember.
  const isGroupWord = (w: string) => w === "SET" || w === "BOTH" || w === "ABC";

  // Book "number + count + subtype", honouring SET / BOTH / Abc.
  function pushByWord(number: string, count: string, word: string, perEntry?: string) {
    const st = (word || "").toUpperCase();
    if (st === "SET") return pushSetBookings(number, Number(count), perEntry);
    if (st === "ABC") return pushAbcBookings(number, Number(count));
    if (st === "BOTH" && number.length === 3) {
      const ok1 = pushBooking(number, Number(count), "SUPER");
      const ok2 = pushBooking(number, Number(count), "BOX");
      return ok1 && ok2;
    }
    return pushBooking(number, Number(count), st);
  }

  // Two counts on one number: SUPER + BOX for 3-digit, otherwise the
  // number's default subtype twice (existing behaviour).
  function pushTwoCounts(number: string, c1: string, c2: string) {
    if (number.length === 3) return pushDualBooking(number, Number(c1), Number(c2));
    return pushBooking(number, Number(c1)) && pushBooking(number, Number(c2));
  }

  // A line that is only a number ("354") inherits the count — and the
  // subtype, where it still applies — from the last plainly-parsed line
  // above it.
  let lastCount: number | null = null;
  let lastBoxCount: number | null = null;
  let lastSubType: string | null = null;
  const remember = (count: string, word?: string, boxCount?: string) => {
    lastCount = Number(count);
    lastBoxCount = boxCount === undefined ? null : Number(boxCount);
    lastSubType = word && !isGroupWord(word) ? word : null;
  };

  // Recognize multiline shorthand before the existing per-line parser.
  // Only explicit count lines consume a run; ordinary bare numbers retain
  // the existing inherited-count behavior.
  const cleanLines = lines.map(line => line.replace(waPrefixRegex, "").trim());
  const multilineEntries = new Map<number, { count: string; boxCount?: string; subType?: string }>();
  const countLines = new Set<number>();
  if (isDefaultDraw) {
    for (let i = 0; i < cleanLines.length; i++) {
      if (!/^\d{3}$/.test(cleanLines[i])) continue;
      const start = i;
      while (i + 1 < cleanLines.length && /^\d{3}$/.test(cleanLines[i + 1])) i++;
      const trailing = cleanLines[i + 1] || "";
      const dual = trailing.match(/^(\d{1,2})\s*[/*]\s*(\d{1,2})$/);
      const single = trailing.match(/^\/?\s*([1-9]\d?)$/);
      if (!dual && !single) continue;
      for (let j = start; j <= i; j++) {
        multilineEntries.set(j, dual
          // In `SUPER/BOX` or `SUPER*BOX` shorthand, the first count is SUPER and the second is BOX.
          ? { count: dual[1], boxCount: dual[2] }
          // A slash-only count ("/1") books BOX; a plain count books SUPER.
          : { count: single![1], subType: trailing.startsWith("/") ? "BOX" : undefined });
      }
      countLines.add(i + 1);
    }
    // A leading dual count applies to the following bare-number run.
    for (let i = 0; i < cleanLines.length; i++) {
      if (countLines.has(i)) continue;
      const dual = cleanLines[i].match(/^(\d{1,2})\s*[/*]\s*(\d{1,2})$/);
      if (!dual || !/^\d{3}$/.test(cleanLines[i + 1] || "")) continue;
      for (let j = i + 1; j < cleanLines.length && /^\d{3}$/.test(cleanLines[j]); j++) {
        if (!multilineEntries.has(j)) {
          multilineEntries.set(j, { count: dual[1], boxCount: dual[2] });
        }
      }
      countLines.add(i);
    }
  }
  for (const [lineIndex, origLine] of lines.entries()) {
    if (countLines.has(lineIndex)) continue;
    let line = origLine;
    let waPrefix = "";

    // WhatsApp prefix
    const waMatch = line.match(waPrefixRegex);
    if (waMatch) {
      waPrefix = waMatch[0];
      line = line.slice(waPrefix.length).trim();
    }

    // If after removing prefix, line is empty, just add the prefix to failedLines and continue
    if (line.length === 0) {
      if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
      continue;
    }

    // Ignore lines like "Dear 6", "Kerala 3"
    if (ignoreLineRegex.test(line) || pendingHeaderRegex.test(line)) continue;

    const fail = () => {
      if (waPrefix.length > 0) failedLines.push(waPrefix.trim());
      failedLines.push(origLine);
    };

    const multiline = multilineEntries.get(lineIndex);
    if (multiline) {
      const ok = multiline.boxCount !== undefined
        ? pushDualBooking(line, Number(multiline.count), Number(multiline.boxCount))
        : pushBooking(line, Number(multiline.count), multiline.subType);
      if (ok) remember(multiline.count, multiline.subType);
      else fail();
      continue;
    }

    if (isDefaultDraw && /^(AB|AC|BC)$/i.test(line)) {
      sectionSubType = line.toUpperCase();
      continue;
    }

    // Multiplication sign and triple-digit "b" suffix are additional aliases.
    line = line.replace(/×/g, "*");
    if (isDefaultDraw && /^\d{3}[.\s=]+\d+\s*b$/i.test(line)) {
      line = line.replace(/b$/i, "BOX");
    }

    const tokens = tokenizeLine(line);
    if (!tokens) {
      fail();
      continue;
    }

    const nums = tokens.filter(t => t.isNum).map(t => t.value);
    const words = tokens.filter(t => !t.isNum).map(t => t.value);
    const shape = tokens.map(t => (t.isNum ? "N" : "W")).join("");

    let ok = false;

    // "709-5,077-6,078-5" — several number/count pairs on one line.
    if (words.length === 0 && nums.length >= 4 && nums.length % 2 === 0) {
      for (let i = 0; i < nums.length; i += 2) {
        if (pushBooking(nums[i], Number(nums[i + 1]))) ok = true;
      }
      if (ok) remember(nums[nums.length - 1]);
      else fail();
      continue;
    }

    switch (shape) {
      // "354" — inherit the count (and subtype) from the line above.
      case "N": {
        if (lastCount === null) break;
        if (isDefaultDraw && nums[0].length === 3 && lastBoxCount !== null) {
          ok = pushDualBooking(nums[0], lastCount, lastBoxCount);
        } else {
          const inherited = lastSubType && isValidSubtypeForNumber(nums[0], lastSubType)
            ? lastSubType
            : undefined;
          ok = pushBooking(nums[0], lastCount, inherited);
        }
        break;
      }

      // "123-5", "123_5", "114;1", "123''1", "123(1)", "312.6", "1/1"
      case "NN": {
        const heading = nums[0].length === 2 ? sectionSubType : undefined;
        ok = pushBooking(nums[0], Number(nums[1]), heading);
        if (ok) remember(nums[1], heading);
        break;
      }

      // "123 5 2", "835--1--1", "123(1)(1)", "123.3.3."
      case "NNN": {
        ok = pushTwoCounts(nums[0], nums[1], nums[2]);
        if (ok) remember(nums[1], undefined, isDefaultDraw && nums[0].length === 3 ? nums[2] : undefined);
        break;
      }

      // "123-5 box", "123.2set", "123=5=both", "123 5 set"
      case "NNW": {
        ok = pushByWord(nums[0], nums[1], words[0]);
        if (ok) remember(nums[1], words[0]);
        break;
      }

      // "123.set.1", "56 AC=5", "123 AB 5"
      case "NWN": {
        ok = pushByWord(nums[0], nums[1], words[0]);
        if (ok) remember(nums[1], words[0]);
        break;
      }

      // "123 5 set box" — SET, plus the subtype each permutation is booked as.
      case "NNWW": {
        if (words[0] === "SET") ok = pushSetBookings(nums[0], Number(nums[1]), words[1]);
        if (ok) remember(nums[1]);
        break;
      }

      // "A 8 150", "bc:43:15", "Abc=6=25", "Set 524.1", "C+7+100"
      case "WNN": {
        ok = pushByWord(nums[0], nums[1], words[0]);
        if (ok) remember(nums[1], words[0]);
        break;
      }

      // "Set 524 5 box" — same as "123 5 set box", SET named first.
      case "WNNW": {
        if (words[0] === "SET") ok = pushSetBookings(nums[0], Number(nums[1]), words[1]);
        if (ok) remember(nums[1]);
        break;
      }

      default: {
        // "Abc-4,6=30" — one subtype, several numbers, then the count.
        if (shape === "W" + "N".repeat(nums.length) && nums.length > 2) {
          const count = nums[nums.length - 1];
          for (const num of nums.slice(0, -1)) {
            if (pushByWord(num, count, words[0])) ok = true;
          }
          if (ok) remember(count, words[0]);
        }
        break;
      }
    }

    if (!ok) fail();
  }

  return {
    bookings: bookings.map(({ number, count, subType }) => ({ number, count, sub_type: subType })),
    failed_lines: failedLines,
  };
}
