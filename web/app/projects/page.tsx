import Upcoming from "@/components/Upcoming";

export default function Projects() {
  return (
    <Upcoming
      n="04"
      title="Projects"
      lead="Your own data, your own model. This section comes after the Books scenes and Lab activities."
      items={[
        "Start a project from an image dataset or a CSV file",
        "Explore the data: types, missing values, class balance, samples",
        "Build with the same split screen as the Lab: code left, live 3D right",
        "Train on this PC, send the job to Kaggle's GPU, or export a ready notebook",
        "Export the whole project as a zip with code, config and trained model",
      ]}
    />
  );
}
