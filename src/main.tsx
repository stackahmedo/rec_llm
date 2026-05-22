  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { installGlobalErrorCapture } from "./app/crash-log-store";

  installGlobalErrorCapture();
  createRoot(document.getElementById("root")!).render(<App />);
