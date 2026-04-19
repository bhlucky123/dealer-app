import api from "@/utils/axios";
import { config } from "@/utils/config";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";

export const useCalculator = () => {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);
  const [secondOperand, setSecondOperand] = useState<string | null>(null);
  const [equation, setEquation] = useState<string>("");
  const [pinInput, setPinInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  const setPreLogin = useAuthStore((s) => s.setPreLogin);
  const setSessionFromV2 = useAuthStore((s) => s.setSessionFromV2);

  const {
    data: equationData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<string[]>({
    queryKey: ["/user/get-initial-user-creds/", "new"],
    queryFn: async () => {
      console.log("api calling");
      const res = await api.get("/user/get-initial-user-creds/?type=new");
      return res.data;
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

  const verifyPin = useCallback(async (calcStr: string, pin: string) => {
    setVerifying(true);

    const showCalcResult = () => {
      const result = evaluateEquation(calcStr);
      setDisplay(result);
      setFirstOperand(parseFloat(result));
      setEquation("");
      setPinInput("");
      setWaitingForSecondOperand(true);
    };

    // v2-only one-step login per 3DLN spec. Do NOT fall back to non-v2 calc+pin URLs —
    // they exist but reject calc+pin on this backend.
    const tryV2 = async (role: "dealer" | "agent") => {
      try {
        const resp = await fetch(`${config.apiBaseUrl}/${role}/login-v2/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calculate_str: calcStr,
            secret_pin: Number(pin),
          }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data?.access ? data : null;
      } catch {
        return null;
      }
    };

    try {
      // One-step login: try dealer then agent
      const dealerData = await tryV2("dealer");
      if (dealerData) {
        setSessionFromV2(dealerData, "DEALER");
        return;
      }

      const agentData = await tryV2("agent");
      if (agentData) {
        setSessionFromV2(agentData, "AGENT");
        return;
      }

      // Fallback: legacy 2-step flow via verify-calculate-str → /login
      //   - Admins (v2 not supported for admins)
      //   - Legacy dealers/agents whose DB row still stores the full-expression calculate_str
      const res = await fetch(`${config.apiBaseUrl}/user/verify-calculate-str/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calculate_str: calcStr,
          secret_pin: Number(pin),
        }),
      });

      if (!res.ok) {
        showCalcResult();
        return;
      }

      const data = await res.json();
      setPreLogin(data.token, data.user_type);
      router.navigate("/login");
    } catch {
      showCalcResult();
    } finally {
      setVerifying(false);
    }
  }, [setPreLogin, setSessionFromV2]);

  const handleEqual = useCallback(() => {
    // PIN entry mode — verify via API
    if (equation) {
      if (!pinInput) return;
      verifyPin(equation, pinInput);
      return;
    }

    if (!operator || firstOperand === null) return;

    const inputValue = parseFloat(display);
    const result = performCalculation(operator, firstOperand, inputValue);

    const equationStr = `${firstOperand}${operator}${secondOperand ?? display}`;
    if (equationData && equationData.includes(equationStr)) {
      setDisplay(""); // Clear display for PIN entry
      setFirstOperand(null);
      setEquation(equationStr);
      setPinInput("");
      } else {
      setDisplay(String(result));
      setFirstOperand(result);
    }

    setOperator(null);
    setExpression("");
    setWaitingForSecondOperand(true);
    setSecondOperand(null);
  }, [display, firstOperand, operator, secondOperand, equationData, equation, pinInput, verifyPin]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setExpression("");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
    setSecondOperand(null);
    setEquation("");
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
        setPinInput("");
      }
    } else {
      setDisplay("0");
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(false);
      setSecondOperand(null);
      setEquation("");
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
