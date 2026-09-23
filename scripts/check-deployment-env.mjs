import { checkDeployment } from "./deployment-env.mjs";

const problems = await checkDeployment(process.env);
if (problems.length) {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Deployment target and required calendar column verified. Full migration and signed-in approval gates still apply.",
  );
}
