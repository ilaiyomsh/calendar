import React from "react";
import { createRoot } from "react-dom/client";
import "@vibe/core/tokens"; // CSS של @vibe/core - חייב להיות לפני ה-CSS שלנו
import "./index.css";
import "./init";
import { setupGlobalErrorHandlers } from './utils/globalErrorHandler';
import App from "./App";

// הגדרת global error handlers לפני טעינת האפליקציה
setupGlobalErrorHandlers();

const root = createRoot(document.getElementById("root"));
root.render(<App />);

