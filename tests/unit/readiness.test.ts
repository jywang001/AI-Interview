import { describe, expect, it } from "vitest";
import { getTrainingReadiness } from "@/lib/interview/readiness";

describe("training readiness labels", () => {
  it.each([
    [100, "表现扎实", "is-strong"],
    [85, "表现扎实", "is-strong"],
    [84, "基本就绪", "is-ready"],
    [70, "基本就绪", "is-ready"],
    [69, "重点补强", "is-developing"],
    [0, "重点补强", "is-developing"],
  ] as const)("maps score %i to a training label", (score, label, className) => {
    expect(getTrainingReadiness(score)).toMatchObject({ label, className });
  });
});
