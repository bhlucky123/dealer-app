import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { WhatsAppContacts, WhatsAppContact, contactErrors, initialContacts } from "../../components/whatsapp-contacts";

test("adds, edits and removes WhatsApp contact rows", () => {
  let current: WhatsAppContact[] = [];
  function Form() { const [rows, setRows] = useState<WhatsAppContact[]>([]); current = rows; return <WhatsAppContacts value={rows} onChange={setRows} />; }
  const screen = render(<Form />);
  fireEvent.press(screen.getByLabelText("Add WhatsApp number"));
  expect(current[0].receive_results).toBe(false);
  fireEvent.changeText(screen.getByLabelText("Phone number 1"), "+919876543210");
  expect(current[0].phone_number).toBe("+919876543210");
  fireEvent.press(screen.getByLabelText("Remove number 1"));
  expect(current).toEqual([]);
});

test("normalizes international numbers and marks duplicate rows", () => {
  const rows = initialContacts({ whatsapp_numbers: ["+91 98765 43210", "00919876543210"], whatsapp_result_subscribed: true });
  expect(rows.map(row => row.receive_results)).toEqual([true, false]);
  expect(contactErrors(rows)).toEqual(["This number is entered more than once", "This number is entered more than once"]);
});

test("tolerates dealer responses without a contacts array", () => {
  expect(initialContacts({ whatsapp_contacts: undefined, whatsapp_numbers: undefined })).toEqual([]);
  expect(contactErrors(undefined)).toEqual([]);
  expect(() => render(<WhatsAppContacts value={undefined} onChange={() => {}} />)).not.toThrow();
});
