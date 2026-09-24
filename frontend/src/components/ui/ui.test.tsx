import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Avatar, Badge, Progress } from "./display";
import { Field, Input } from "./field";

describe("Button", () => {
  it("disables and marks busy while loading", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Publish</Button>);
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child element when asChild", () => {
    render(
      <Button asChild>
        <a href="/create">Create</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/create");
  });
});

describe("Field", () => {
  it("wires label, error and aria attributes", () => {
    render(
      <Field label="Email" error="Enter a valid email address">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email address");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
  });
});

describe("display primitives", () => {
  it("renders a monogram avatar with an accessible name", () => {
    render(<Avatar name="Mara Collective" />);
    expect(screen.getByLabelText("Mara Collective")).toHaveTextContent("MC");
  });

  it("clamps progress and exposes it to assistive tech", () => {
    render(<Progress value={140} label="Match" />);
    expect(screen.getByRole("progressbar", { name: "Match" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders status badges", () => {
    render(<Badge tone="accent">Published</Badge>);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});
