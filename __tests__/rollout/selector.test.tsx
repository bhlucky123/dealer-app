import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Dropdown } from "../../components/searchable-selector";

test("searches a large list, selects a row and clears through the same callback", () => {
  const changed = jest.fn();
  const rows = Array.from({ length: 1000 }, (_, id) => ({ label: `Dealer ${id}`, value: id }));
  const screen = render(<Dropdown data={rows} labelField="label" valueField="value" value="" onChange={changed} placeholder="Dealer" />);
  fireEvent.press(screen.getByLabelText("Dealer"));
  fireEvent.changeText(screen.getByLabelText("Search options"), "Dealer 999");
  fireEvent.press(screen.getByText("Dealer 999"));
  expect(changed).toHaveBeenLastCalledWith(rows[999]);
  fireEvent.press(screen.getByLabelText("Dealer"));
  fireEvent.press(screen.getByText("Clear selection"));
  expect(changed).toHaveBeenLastCalledWith({ label: "", value: "" });
});

test("shows an empty state and closes on Android back", () => {
  const screen = render(<Dropdown data={[]} labelField="label" valueField="value" value="" onChange={jest.fn()} placeholder="Dealer" />);
  fireEvent.press(screen.getByLabelText("Dealer"));
  expect(screen.getByText("No options available")).toBeTruthy();
  fireEvent(screen.UNSAFE_getByType(require("react-native").Modal), "requestClose");
  expect(screen.queryByText("No options available")).toBeNull();
});

test("dealer change and clear invalidate the agent selection", () => {
  const { changeDealerSelection } = require("../../utils/account-selection");
  const dealer = jest.fn(), agent = jest.fn();
  changeDealerSelection("next", dealer, agent);
  expect(dealer).toHaveBeenLastCalledWith("next");
  expect(agent).toHaveBeenLastCalledWith("");
  changeDealerSelection("", dealer, agent);
  expect(dealer).toHaveBeenLastCalledWith("");
  expect(agent).toHaveBeenCalledTimes(2);
});
