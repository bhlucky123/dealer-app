import { config } from "@/utils/config";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";

export const useCalculator = () => {
  const [display, setDisplay] = useState("0");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);
  const [secondOperand, setSecondOperand] = useState<string | null>(null);
  const [equation, setEquation] = useState<string>("");
  const [pinInput, setPinInput] = useState("");

  const {
    data: equationData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/user/get-initial-user-creds/"],
    queryFn: () => {
      return fetch(
        `${config.apiBaseUrl}/user/get-initial-user-creds/`,
        {
          headers: {
            "User-Type": config.userType
          },
        }
      ).then((res) => res.json());
    },
  });

  console.log("equationData", equationData);

  // Helper to check if a valid equation exists and enter PIN mode if so
  const tryEnterPinMode = useCallback(
    (first: number | null, op: string | null, second: string | null, disp: string) => {
      if (!op || first === null) return false;
      const equationStr = `${first}${op}${second ?? disp}`;
      if (equationData && !!equationData[equationStr]) {
        setDisplay(""); // Clear display for PIN entry
        setFirstOperand(null);
        setEquation(equationStr);
        setPinInput(""); // Also clear any previous pin input
        setOperator(null);
        setWaitingForSecondOperand(false);
        setSecondOperand(null);
        return true;
      }
      return false;
    },
    [equationData]
  );

  const handleNumberInput = useCallback(
    (digit: string) => {
      if (equation) {
        // Now user is entering PIN
        // If display is not empty, clear it and pinInput for fresh PIN entry
        if (display !== "" || pinInput === "") {
          setDisplay("");
          setPinInput(digit);
        } else {
          setPinInput((prev) => prev + digit);
        }
        const correctPin = equationData?.[equation];
        const updatedPin = (display !== "" || pinInput === "") ? digit : pinInput + digit;
        if (correctPin && Number(updatedPin) === Number(correctPin)) {
          router.navigate("/login");
        }
        return;
      }

      // If the previous result was shown (after pressing =), and user starts typing a new number,
      // check if the new equation (with previous firstOperand, operator, and this digit) is in equationData
      // This is the key addition for the prompt
      if (
        !operator && // No operator, just entering numbers
        firstOperand !== null &&
        waitingForSecondOperand
      ) {
        // User pressed =, then deleted result, then started typing a new number
        // Reset everything for a new calculation
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
        // User just pressed an operator, now entering second operand
        setDisplay(digit);
        setWaitingForSecondOperand(false);
        setSecondOperand(digit);

        // Check if this new equation is in equationData
        if (
          operator &&
          firstOperand !== null &&
          equationData &&
          equationData[`${firstOperand}${operator}${digit}`]
        ) {
          setDisplay(""); // Clear display for PIN entry
          setFirstOperand(null);
          setEquation(`${firstOperand}${operator}${digit}`);
          setPinInput("");
          setOperator(null);
          setWaitingForSecondOperand(false);
          setSecondOperand(null);
          return;
        }
      } else {
        const newDisplay = display === "0" ? digit : display + digit;
        setDisplay(newDisplay);
        if (operator && firstOperand !== null) {
          setSecondOperand((prev) => (prev ? prev + digit : digit));
          // Check if this new equation is in equationData
          const eqStr = `${firstOperand}${operator}${(secondOperand ? secondOperand + digit : digit)}`;
          if (equationData && equationData[eqStr]) {
            setDisplay(""); // Clear display for PIN entry
            setFirstOperand(null);
            setEquation(eqStr);
            setPinInput("");
            setOperator(null);
            setWaitingForSecondOperand(false);
            setSecondOperand(null);
            return;
          }
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
      equationData,
      secondOperand,
    ]
  );

  const handleOperator = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(display);

      if (firstOperand === null) {
        setFirstOperand(inputValue);
      } else if (operator) {
        const result = performCalculation(operator, firstOperand, inputValue);
        setDisplay(String(result));
        setFirstOperand(result);
      }

      setWaitingForSecondOperand(true);
      setOperator(nextOperator);
      setSecondOperand(null); // Reset second operand for new input
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

  const handleEqual = useCallback(() => {
    if (!operator || firstOperand === null) return;

    const inputValue = parseFloat(display);
    const result = performCalculation(operator, firstOperand, inputValue);

    const equationStr = `${firstOperand}${operator}${secondOperand ?? display}`;
    console.log("Equation:", equationStr); // ✅ You’ll see "2+5"
    if (equationData && !!equationData[equationStr]) {
      setDisplay(""); // Clear display for PIN entry
      setFirstOperand(null);
      setEquation(equationStr);
      setPinInput(""); // Also clear any previous pin input
    } else {
      setDisplay(String(result));
      setFirstOperand(result);
    }

    setOperator(null);
    setWaitingForSecondOperand(true);
    setSecondOperand(null);
  }, [display, firstOperand, operator, secondOperand, equationData]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
    setSecondOperand(null);
    setEquation("");
    setPinInput("");
  }, []);

  const handleDelete = useCallback(() => {
    if (equation) {
      // If in PIN entry mode, delete from pinInput
      if (pinInput.length > 0) {
        setPinInput(pinInput.slice(0, -1));
      }
      // Optionally, you could clear display as well, but not necessary
      return;
    }
    if (display.length > 1) {
      const newDisplay = display.slice(0, -1);
      setDisplay(newDisplay);

      // If user deletes all digits and display becomes empty or "0", reset state
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
    handleNumberInput,
    handleOperator,
    handleClear,
    handleEqual,
    handleDelete,
    pinInput,
    isLoading,
    isError, 
    error
  };
};
