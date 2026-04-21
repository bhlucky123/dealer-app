import api from "@/utils/axios";
import { config } from "@/utils/config";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";

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
      const raw = res.data;
      // Defensive: tolerate legacy response shape (flat list of strings).
      if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
        return (raw as string[]).map((s) => ({
          calculate_str: s,
          user_type: "DEALER" as ServerUserType,
        }));
      }
      return Array.isArray(raw) ? (raw as InitialCred[]) : [];
    },
  });

  console.log("err", error);
  console.log("equationData", equationData);

  const handleNumberInput = useCallback(
    (digit: string) => {
      if (equation) {
        // User is entering PIN — just accumulate digits
        if (display !== "" || pinInput === "") {
          setDisplay("");
          setPinInput(digit);
        } else {
          setPinInput((prev) => prev + digit);
        }

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

      const showCalcResult = () => {
        const result = evaluateEquation(calcStr);
        setDisplay(result);
        setFirstOperand(parseFloat(result));
        setEquation("");
        setEquationUserType(null);
        setPinInput("");
        setWaitingForSecondOperand(true);
      };

      const body = JSON.stringify({
        calculate_str: calcStr,
        secret_pin: Number(pin),
      });

      try {
        if (userType === "DEALER" || userType === "AGENT") {
          // One-step JWT login — endpoint is picked directly from the user type
          // returned by /user/get-initial-user-creds/, no blind trial-and-error.
          const role = userType === "DEALER" ? "dealer" : "agent";
          const resp = await fetch(`${config.apiBaseUrl}/${role}/login-v2/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          if (!resp.ok) {
            showCalcResult();
            return;
          }
          const data = await resp.json();
          if (!data?.access) {
            showCalcResult();
            return;
          }
          setSessionFromV2(data, userType);
          return;
        }

        if (userType === "ADMIN") {
          // Admins still use the legacy 2-step verify → /login flow because
          // there's no /administrator/login-v2/.
          const res = await fetch(
            `${config.apiBaseUrl}/user/verify-calculate-str/`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            }
          );
          if (!res.ok) {
            showCalcResult();
            return;
          }
          const data = await res.json();
          setPreLogin(data.token, data.user_type);
          router.navigate("/login");
          return;
        }

        // No user_type resolved (shouldn't happen since we only enter PIN mode
        // when the typed expression matches a cred entry). Degrade gracefully.
        showCalcResult();
      } catch {
        showCalcResult();
      } finally {
        setVerifying(false);
      }
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
