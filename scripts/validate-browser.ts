const { runPresentationWorkflowValidation } = require("./validate-presentation-workflow.ts");
const { runStudioLayoutValidation } = require("./validate-studio-layout.ts");

type BrowserValidationFlow = "all" | "presentation" | "studio";

async function main() {
  const flow = (process.argv[2] || "all") as BrowserValidationFlow;
  if (!["all", "presentation", "studio"].includes(flow)) {
    throw new Error(`Unknown browser validation flow "${flow}". Use all, presentation, or studio.`);
  }

  if (flow === "presentation") {
    await runPresentationWorkflowValidation();
    return;
  }

  if (flow === "studio") {
    await runStudioLayoutValidation();
    return;
  }

  const { server } = await runPresentationWorkflowValidation({ keepServerOpen: true });

  try {
    await runStudioLayoutValidation({ server });
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
