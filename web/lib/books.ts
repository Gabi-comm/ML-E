export type Chapter = { n: number; title: string; visual: string };
export type Book = { id: string; title: string; author: string; note?: string; chapters: Chapter[] };

// Chapter titles are the books' own; the "visual" lines describe ML-E's original scenes.
export const BOOKS: Book[] = [
  {
    id: "homl",
    title: "Hands-On Machine Learning",
    author: "Aurélien Géron · 3rd edition",
    chapters: [
      { n: 1, title: "The Machine Learning Landscape", visual: "Map of ML types; overfitting vs underfitting slider" },
      { n: 2, title: "End-to-End Machine Learning Project", visual: "Animated pipeline over the housing data" },
      { n: 3, title: "Classification", visual: "Threshold slider driving precision, recall and ROC" },
      { n: 4, title: "Training Models", visual: "3D loss surface with a gradient descent ball" },
      { n: 5, title: "Support Vector Machines", visual: "Margins, support vectors, kernels lifting 2D into 3D" },
      { n: 6, title: "Decision Trees", visual: "A tree growing split by split beside the regions it carves" },
      { n: 7, title: "Ensemble Learning and Random Forests", visual: "Many trees voting; boosting fixing errors each round" },
      { n: 8, title: "Dimensionality Reduction", visual: "3D point cloud projected by PCA; swiss roll unrolling" },
      { n: 9, title: "Unsupervised Learning Techniques", visual: "K-means centroids moving; DBSCAN; Gaussian mixtures" },
      { n: 10, title: "Introduction to Artificial Neural Networks with Keras", visual: "Perceptron to MLP in 3D with a forward pass" },
      { n: 11, title: "Training Deep Neural Networks", visual: "Vanishing gradients through layers; optimizers racing" },
      { n: 12, title: "Custom Models and Training with TensorFlow", visual: "Computation graph and gradient tape, step by step" },
      { n: 13, title: "Loading and Preprocessing Data with TensorFlow", visual: "The data pipeline as a conveyor" },
      { n: 14, title: "Deep Computer Vision Using Convolutional Neural Networks", visual: "A 3D filter sliding over an image; feature-map stacks" },
      { n: 15, title: "Processing Sequences Using RNNs and CNNs", visual: "A network unrolling through time" },
      { n: 16, title: "Natural Language Processing with RNNs and Attention", visual: "Attention lines between tokens; a transformer block in 3D" },
      { n: 17, title: "Autoencoders, GANs, and Diffusion Models", visual: "Latent-space walk; noise turning into an image" },
      { n: 18, title: "Reinforcement Learning", visual: "An agent learning a grid world with a value heatmap" },
      { n: 19, title: "Training and Deploying TensorFlow Models at Scale", visual: "Serving and scaling flow" },
    ],
  },
  {
    id: "aie",
    title: "AI Engineering",
    author: "Building applications with foundation models",
    chapters: [
      { n: 1, title: "Introduction to Building AI Applications with Foundation Models", visual: "The AI stack in layers; tokens being predicted" },
      { n: 2, title: "Understanding Foundation Models", visual: "Transformer in 3D; temperature, top-k and top-p playground" },
      { n: 3, title: "Evaluation Methodology", visual: "Entropy and perplexity meters; embedding space in 3D" },
      { n: 4, title: "Evaluate AI Systems", visual: "Model selection funnel; cost vs latency vs quality" },
      { n: 5, title: "Prompt Engineering", visual: "A context window filling up; prompt injection walk-through" },
      { n: 6, title: "RAG and Agents", visual: "Query, retrieve, generate; the agent plan-tool-memory loop" },
      { n: 7, title: "Finetuning", visual: "LoRA matrices; quantization shrinking numbers; memory math" },
      { n: 8, title: "Dataset Engineering", visual: "Curate, synthesise, dedupe, clean as one pipeline" },
      { n: 9, title: "Inference Optimization", visual: "Batching, latency metrics, pruning and distillation" },
      { n: 10, title: "AI Engineering Architecture and User Feedback", visual: "A system assembled one step at a time" },
    ],
  },
];

/** chapters whose scenes are built (keys match lib/scenes.tsx) */
export const BUILT = new Set(["homl-1", "homl-2", "homl-3", "homl-4", "homl-5", "homl-6", "homl-7", "homl-8", "homl-9", "homl-10", "homl-11", "homl-12", "homl-13", "homl-14", "homl-15", "homl-16", "homl-17", "homl-18", "homl-19", "aie-1", "aie-2", "aie-3", "aie-4", "aie-5", "aie-6", "aie-7", "aie-8", "aie-9", "aie-10"]);
