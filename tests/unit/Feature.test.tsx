import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature, isValidObservation, timeUntil } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders an accessible coarse pin board when connected", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    expect(
      screen.getByRole("heading", { name: "See the room, not the people." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Filter observations by broad area" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /notes, not selected/i })).toHaveLength(9);
    expect(screen.getByText("Accessible list")).toBeInTheDocument();
  });

  it("shows a connecting state when room is null", () => {
    render(<Feature room={null} config={config} />);
    expect(screen.getByText(/Joining the shared board/i)).toBeInTheDocument();
  });

  it("validates only bounded coarse observations", () => {
    const now = 100;
    expect(
      isValidObservation({
        id: "1234567890abcdef",
        title: "Open desk",
        note: "",
        area: "centre",
        createdAt: now,
        expiresAt: now + 1,
        author: "Ari",
      }),
    ).toBe(true);
    expect(
      isValidObservation({
        id: "bad",
        title: "x",
        note: "",
        area: "centre",
        createdAt: now,
        expiresAt: now + 1,
        author: "Ari",
      }),
    ).toBe(false);
    expect(timeUntil(61_000, 0)).toBe("2m left");
  });
});
