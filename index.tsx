
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const startApp = async () => {
  let initialProject = null;
  const LOCAL_STORAGE_KEY = 'textureAppProject';

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

  // 2. If not loaded from localStorage, fetch the default project
  if (!initialProject) {
    try {
      const response = await fetch('/default-project.json');
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      initialProject = await response.json();
      console.log("Default project loaded from file.");
    } catch (error) {
        console.error("Failed to load initial project data:", error);
        root.render(
            <div className="bg-gray-900 text-red-400 min-h-screen flex items-center justify-center p-4">
                <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold mb-4">Error Crítico</h1>
                    <p>No se pudo cargar la configuración inicial del proyecto.</p>
                    <p className="text-sm text-gray-400 mt-2">Por favor, revisa la consola para más detalles.</p>
                </div>
            </div>
        );
        return; // Stop execution if default project fails to load
    }
  }
  
  // 3. Render the application with the loaded project
  root.render(
    <React.StrictMode>
      <App initialProject={initialProject} />
    </React.StrictMode>
  );
};

startApp();
