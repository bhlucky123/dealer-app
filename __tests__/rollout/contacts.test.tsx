import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { WhatsAppContacts, WhatsAppContact, contactErrors, initialContacts } from "../../components/whatsapp-contacts";

test("adds unsubscribed contacts, edits subscription and removes rows", () => {
  let current: WhatsAppContact[] = [];
  function Form() { const [rows, setRows] = useState<WhatsAppContact[]>([]); current = rows; return <WhatsAppContacts value={rows} onChange={setRows} />; }
  const screen = render(<Form />);
  fireEvent.press(screen.getByText("+ Add number"));
  expect(current[0].receive_results).toBe(false);
  fireEvent.changeText(screen.getByLabelText("Phone number 1"), "+919876543210");
  fireEvent(screen.getByLabelText("Receive results 1"), "valueChange", true);
  expect(current[0].receive_results).toBe(true);
  fireEvent.press(screen.getByText("Remove number"));
  expect(current).toEqual([]);
});

test("normalizes international numbers and marks duplicate rows", () => {
  const rows = initialContacts({ whatsapp_numbers: ["+91 98765 43210", "00919876543210"], whatsapp_result_subscribed: true });
  expect(rows.map(row => row.receive_results)).toEqual([true, false]);
  expect(contactErrors(rows)).toEqual(["This number is entered more than once", "This number is entered more than once"]);
});
