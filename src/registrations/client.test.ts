import { describe, expect, it, vi } from "vitest";
import { createRegistrationSubmission } from "./client";

const input = { city: "안성시", school: "시험학교", assignment: "교사", name: "시험교사", lessonIds: ["lesson-6-1"], consent: true, question: "" };
const success = { ok: true, status: "saved", registrationId: "receipt", submittedAt: "2026-10-16T00:00:00.000Z" };

describe("submission state for the later form", () => {
  it("locks while pending, sends only one request and succeeds only after the response", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const onChange = vi.fn();
    const client = createRegistrationSubmission(onChange, fetcher);
    const pending = client.submit(input);
    expect(client.getState().phase).toBe("submitting");
    expect(await client.submit(input)).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    finish(Response.json(success, { status: 201 }));
    expect(await pending).toEqual(success);
    expect(onChange.mock.calls.map(call => call[0].phase)).toEqual(["submitting", "saved"]);
  });

  it.each(["provider", "network", "invalid-json", "false-success"])("keeps input and unlocks on %s failure without retrying automatically", async kind => {
    const fetcher = vi.fn(async () => {
      if (kind === "network") throw new Error("offline");
      if (kind === "invalid-json") return new Response("bad response", { status: 502 });
      if (kind === "false-success") return Response.json(success, { status: 200 });
      return Response.json({ ok: false, code: "SAVE_NOT_CONFIRMED", message: "다시 시도", retryable: true }, { status: 503 });
    });
    const client = createRegistrationSubmission(() => {}, fetcher);
    const result = await client.submit(input);
    expect(result?.ok).toBe(false);
    expect(client.getState().phase).toBe("error");
    expect(client.getState().input).toEqual(input);
    expect(fetcher).toHaveBeenCalledOnce();
    await client.submit(input);
    expect(fetcher).toHaveBeenCalledTimes(2); // Explicit retry is allowed.
  });
});
