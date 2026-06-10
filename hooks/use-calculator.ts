import api from "@/utils/axios";
import axios from "axios";
import { config } from "@/utils/config";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

type ServerUserType = "ADMIN" | "DEALER" | "AGENT";
type InitialCred = { calculate_str: string; user_type: ServerUserType };

export const useCalculator = () => {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);
  const [secondOperand, setSecondOperand] = useState<string | null>(null);
  const [equation, setEquation] = useState<string>("");
  const [equationUserType, setEquationUserType] = useState<ServerUserType | null>(
    null
  );
  const [pinInput, setPinInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  const setPreLogin = useAuthStore((s) => s.setPreLogin);
  const setSessionFromV2 = useAuthStore((s) => s.setSessionFromV2);

  const {
    data: equationData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<InitialCred[]>({
    queryKey: ["/user/get-initial-user-creds/", "new"],
    queryFn: async () => {
      const res = await api.get("/user/get-initial-user-creds/?type=new");
      return Array.isArray(res.data) ? (res.data as InitialCred[]) : [];
    },
  });

  console.log("err", error);
  console.log("equationData", equationData);

  const handleNumberInput = useCallback(
    (digit: string) => {
      if (equation) {
        // PIN entry mode — accumulate digits. Always use a functional update
        // so rapid taps can't read a stale `pinInput` from the callback
        // closure and overwrite digits already entered. (`handleEqual` already
        // clears the display and resets `pinInput` when PIN mode begins, so the
        // first append onto "" correctly yields just the first digit.)
        setDisplay("");
        setPinInput((prev) => prev + digit);
        return;
      }

      if (
        !operator &&
        firstOperand !== null &&
        waitingForSecondOperand
      ) {
        setDisplay(digit);
        setFirstOperand(null);
        setOperator(null);
        setWaitingForSecondOperand(false);
        setSecondOperand(null);
        setEquation("");
        setEquationUserType(null);
        setPinInput("");
        return;
      }

      if (waitingForSecondOperand) {
        setDisplay(digit);
        setWaitingForSecondOperand(false);
        setSecondOperand(digit);
      } else {
        const newDisplay = display === "0" ? digit : display + digit;
        setDisplay(newDisplay);
        if (operator && firstOperand !== null) {
          setSecondOperand((prev) => (prev ? prev + digit : digit));
        }
      }
    },
    [
      display,
      waitingForSecondOperand,
      operator,
      firstOperand,
      pinInput,
      equation,
      secondOperand,
    ]
  );

  const operatorSymbol = (op: string) => {
    switch (op) {
      case "*": return "\u00d7";
      case "/": return "\u00f7";
      case "-": return "\u2212";
      default: return op;
    }
  };

  const handleOperator = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(display);

      if (firstOperand === null) {
        setFirstOperand(inputValue);
        setExpression(`${display} ${operatorSymbol(nextOperator)} `);
      } else if (operator) {
        const result = performCalculation(operator, firstOperand, inputValue);
        setDisplay(String(result));
        setFirstOperand(result);
        setExpression(`${result} ${operatorSymbol(nextOperator)} `);
      } else {
        setExpression(`${firstOperand} ${operatorSymbol(nextOperator)} `);
      }

      setWaitingForSecondOperand(true);
      setOperator(nextOperator);
      setSecondOperand(null);
    },
    [display, firstOperand, operator]
  );

  const performCalculation = (
    op: string,
    first: number,
    second: number
  ): number => {
    switch (op) {
      case "+":
        return first + second;
      case "-":
        return first - second;
      case "*":
        return first * second;
      case "/":
        return first / second;
      case "%":
        return first % second;
      default:
        return second;
    }
  };

  const evaluateEquation = (calcStr: string): string => {
    try {
      const match = calcStr.match(/^(-?\d+\.?\d*)([\+\-\*\/\%])(-?\d+\.?\d*)$/);
      if (!match) return "0";
      const [, a, op, b] = match;
      return String(performCalculation(op, parseFloat(a), parseFloat(b)));
    } catch {
      return "0";
    }
  };

  const verifyPin = useCallback(
    async (calcStr: string, pin: string, userType: ServerUserType | null) => {
      setVerifying(true);

      const showCalcResult = (message = "Incorrect calculation or secret PIN. Please try again.") => {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Login failed",
          textBody: message,
        });
        const result = evaluateEquation(calcStr);
        setDisplay(result);
        setFirstOperand(parseFloat(result));
        setEquation("");
        setEquationUserType(null);
        setPinInput("");
        setWaitingForSecondOperand(true);
      };

      // Resolve the endpoint up front from the user_type captured at match time.
      const endpoint =
        userType === "DEALER"
          ? `${config.apiBaseUrl}/dealer/login-v2/`
          : userType === "AGENT"
          ? `${config.apiBaseUrl}/agent/login-v2/`
          : userType === "ADMIN"
          ? `${config.apiBaseUrl}/user/verify-calculate-str/`
          : null;

      if (!endpoint) {
        // No user_type resolved (shouldn't happen — we only enter PIN mode when
        // the typed expression matches a cred entry). Degrade gracefully.
        showCalcResult();
        setVerifying(false);
        return;
      }

      // Phase 1: the network call. Use axios (XHR) rather than fetch — every
      // other working screen in the app talks to this backend through axios,
      // and raw fetch was intermittently rejecting on-device (surfacing as a
      // false "couldn't reach the server"). `validateStatus: () => true` lets us
      // tell apart a real transport failure (throws → caught below) from a 401
      // wrong-PIN response (resolves with a status we inspect ourselves), and a
      // bare axios call avoids the shared interceptor's 401 → router.push("/").
      // okhttp (React Native's HTTP client) silently retries idempotent GETs on
      // a stale/dropped keep-alive connection but NOT POSTs, so a POST sent on a
      // dead reused connection fails outright. Retry the transport failure
      // ourselves — a fresh attempt opens a new connection and succeeds. We only
      // retry when no HTTP response came back; any real response (200, 401, …)
      // breaks the loop and is handled below.
      let resp: { status: number; data: any } | null = null;
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          resp = await axios.post(
            endpoint,
            { calculate_str: calcStr, secret_pin: Number(pin) },
            {
              headers: { "Content-Type": "application/json" },
              timeout: 20000,
              validateStatus: () => true,
            }
          );
          break;
        } catch (e) {
          // The request never completed — transport/connection failure.
          console.log(`verifyPin request failed (attempt ${attempt})`, e);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
          }
        }
      }

      if (!resp) {
        setVerifying(false);
        showCalcResult(
          "Couldn't reach the server. Check your connection and try again."
        );
        return;
      }

      if (resp.status < 200 || resp.status >= 300) {
        // Server reached and responded, but rejected the credentials.
        setVerifying(false);
        showCalcResult();
        return;
      }

      // 2xx — axios has already parsed the JSON body into `resp.data`.
      const data: any = resp.data;

      setVerifying(false);

      if (!data) {
        // Login succeeded server-side but we couldn't read the response.
        showCalcResult("Couldn't read the login response. Please try again.");
        return;
      }

      // Phase 2: success. Hand off to the auth store / login screen. This is
      // deliberately OUTSIDE the try above — a routing or state-update hiccup
      // here must NOT masquerade as a failed login and show the calc sum.
      if (userType === "DEALER" || userType === "AGENT") {
        if (!data.access) {
          showCalcResult();
          return;
        }
        setSessionFromV2(data, userType);
        return;
      }

      // ADMIN — stash the pre-login token and go to the username/password screen.
      // Use router.replace (same imperative API the rest of the app relies on)
      // so the calculator isn't left underneath to be navigated back to.
      setEquation("");
      setEquationUserType(null);
      setPinInput("");
      setPreLogin(data.token, data.user_type);
      router.replace("/login");
    },
    [setPreLogin, setSessionFromV2]
  );

  const handleEqual = useCallback(() => {
    // PIN entry mode — verify via API using the user_type we captured when
    // the equation was matched.
    if (equation) {
      if (!pinInput) return;
      verifyPin(equation, pinInput, equationUserType);
      return;
    }

    if (!operator || firstOperand === null) return;

    const inputValue = parseFloat(display);
    const result = performCalculation(operator, firstOperand, inputValue);

    const equationStr = `${firstOperand}${operator}${secondOperand ?? display}`;
    const match = equationData?.find((e) => e.calculate_str === equationStr);
    if (match) {
      setDisplay(""); // Clear display for PIN entry
      setFirstOperand(null);
      setEquation(equationStr);
      setEquationUserType(match.user_type);
      setPinInput("");
    } else {
      setDisplay(String(result));
      setFirstOperand(result);
    }

    setOperator(null);
    setExpression("");
    setWaitingForSecondOperand(true);
    setSecondOperand(null);
  }, [
    display,
    firstOperand,
    operator,
    secondOperand,
    equationData,
    equation,
    equationUserType,
    pinInput,
    verifyPin,
  ]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setExpression("");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
    setSecondOperand(null);
    setEquation("");
    setEquationUserType(null);
    setPinInput("");
  }, []);

  const handleDelete = useCallback(() => {
    if (equation) {
      if (pinInput.length > 0) {
        setPinInput(pinInput.slice(0, -1));
      }
      return;
    }
    if (display.length > 1) {
      const newDisplay = display.slice(0, -1);
      setDisplay(newDisplay);

      if (newDisplay === "" || newDisplay === "0") {
        setDisplay("0");
        setFirstOperand(null);
        setOperator(null);
        setWaitingForSecondOperand(false);
        setSecondOperand(null);
        setEquation("");
        setEquationUserType(null);
        setPinInput("");
      }
    } else {
      setDisplay("0");
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(false);
      setSecondOperand(null);
      setEquation("");
      setEquationUserType(null);
      setPinInput("");
    }
  }, [display, equation, pinInput]);

  return {
    display,
    expression,
    handleNumberInput,
    handleOperator,
    handleClear,
    handleEqual,
    handleDelete,
    pinInput,
    isLoading: isLoading || verifying,
    isError,
    error,
    refetch
  };
};
