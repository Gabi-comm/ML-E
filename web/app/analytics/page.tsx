import Upcoming from "@/components/Upcoming";

export default function Analytics() {
  return (
    <Upcoming
      n="05"
      title="Analytics"
      lead="Upload a trained model with test data and see how it really performs."
      items={[
        "Confusion matrix, precision, recall and F1 per class",
        "ROC and precision-recall curves; the examples it got most wrong",
        "Predicted vs actual and residuals for regression",
        "The model itself in 3D: layers, parameter counts, weight distributions",
        "Two models side by side",
      ]}
    />
  );
}
