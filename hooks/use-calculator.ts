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

  const { data: equationData } = useQuery({
    queryKey: ["/user/get-initial-user-creds/"],
    queryFn: () => {
      return fetch(
        `${config.apiBaseUrl}/user/get-initial-user-creds/`,
        {
          headers: {
            "User-Type": config.userType,
          },
        }
      ).then((res) => res.json());
    },
  });

  console.log("equationData", equationData);


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
      equationData,
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
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
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
  };
};
