const steps = [
  { id: "prepare", label: "材料" },
  { id: "confirm", label: "确认" },
  { id: "interview", label: "面试" },
  { id: "report", label: "复盘" },
  { id: "drill", label: "重练" },
] as const;

type FlowStep = (typeof steps)[number]["id"];

export function FlowProgress({ current }: { current: FlowStep }) {
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <ol className="flow-progress" aria-label="训练进度">
      {steps.map((step, index) => {
        const state =
          index < currentIndex
            ? "is-complete"
            : index === currentIndex
              ? "is-current"
              : "";

        return (
          <li className={state} key={step.id}>
            <span>{index + 1}</span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
