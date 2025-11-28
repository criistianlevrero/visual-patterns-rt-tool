
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { env, logEnvConfig } from './config';
import type { Project } from './types';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// The application now starts asynchronously to fetch the default project data.
const startApp = async () => {
  let initialProject: Project | null = null;
  const LOCAL_STORAGE_KEY = 'textureAppProject';
  
  // Log environment configuration
  logEnvConfig();
  
  // Expose debug controls globally (only if debug mode is enabled)
  if (env.debugMode) {
    (window as any).__DEBUG_SEQUENCER = false;
    (window as any).enableDebug = () => {
      (window as any).__DEBUG_SEQUENCER = true;
      console.log('🐛 Debug mode enabled. Sequencer logs will appear in console.');
    };
    (window as any).disableDebug = () => {
      (window as any).__DEBUG_SEQUENCER = false;
      console.log('🐛 Debug mode disabled.');
    };
    console.log('💡 Debug helpers available: window.enableDebug() / window.disableDebug()');
  }

  // 0. Fetch the default project data from the JSON file (served from /public).
  let defaultProjectData: Project | null = null;
  try {
    const response = await fetch('/default-project.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch default-project.json: ${response.statusText}`);
    }
    defaultProjectData = await response.json();
  } catch (error) {
    console.error("Could not load default project data:", error);
    // A simple error UI if the default configuration can't be loaded.
    root.render(
        <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400">
            Error loading application configuration. Please check the console.
        </div>
    );
    return;
  }

  // 1. Try to load from localStorage
  try {
    const savedProjectJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedProjectJSON) {
      const savedProject = JSON.parse(savedProjectJSON);
      // Basic validation to ensure it's a valid project structure
      if (savedProject.globalSettings && savedProject.sequences) {
        initialProject = savedProject;
        // Always start with the sequencer stopped when loading a session.
        initialProject.globalSettings.isSequencerPlaying = false;
        console.log("Project loaded from localStorage.");
      } else {
        console.warn("localStorage data is invalid, loading default project.");
      }
    }
  } catch (error) {
    console.error("Failed to load or parse project from localStorage:", error);
    // Clear corrupted data to prevent future errors
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  // 2. If not loaded from localStorage, use the fetched default project
  if (!initialProject && defaultProjectData) {
    initialProject = defaultProjectData;
    console.log("Default project loaded from file.");
  }
  
  // 3. Render the application with the loaded project
  if (initialProject) {
      root.render(
        <React.StrictMode>
          <App initialProject={initialProject} />
        </React.StrictMode>
      );
  } else {
      console.error("Failed to initialize project.");
       root.render(
        <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400">
            Could not initialize the project.
        </div>
    );
  }
};

startApp();
